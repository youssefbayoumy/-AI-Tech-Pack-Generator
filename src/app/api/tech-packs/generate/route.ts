import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { generationErrorMessages, type GenerationErrorCode } from '../../../../lib/ai/errors';
import { classifyGenerationFailure } from '../../../../lib/ai/failure-classification';
import {
  createSafeGenerationDiagnostics,
  diagnosticsForServerLog,
  generateTechPack,
} from '../../../../lib/ai/generate-tech-pack';
import { MAX_MULTIPART_BYTES } from '../../../../lib/ai/image/policy';
import { validateImageBytes } from '../../../../lib/ai/image/validate';
import { OpenAiProviderError } from '../../../../lib/ai/openai/adapter';
import { GeminiProviderError } from '../../../../lib/ai/gemini/adapter';
import { OpenRouterProviderError } from '../../../../lib/ai/openrouter/adapter';
import { createTechPackProvider } from '../../../../lib/ai/provider/create';
import {
  isFileUpload,
  parseBuyerDescription,
  readBoundedFormData,
  RequestBodyTooLargeError,
} from '../../../../lib/ai/request-validation';
import {
  getAiRuntimeConfiguration,
  MissingOpenAiConfigurationError,
  MissingGeminiConfigurationError,
  MissingOpenRouterConfigurationError,
} from '../../../../lib/ai/server-config';
import type { AiRuntimeConfiguration } from '../../../../lib/ai/server-config';

export const runtime = 'nodejs';

function safeErrorResponse(requestId: string, code: GenerationErrorCode, status: number) {
  return NextResponse.json(
    { requestId, error: generationErrorMessages[code] },
    { status },
  );
}

function logGeneration(event: {
  requestId: string;
  provider?: string;
  model?: string;
  durationMs: number;
  repairUsed?: boolean | null;
  diagnostics?: ReturnType<typeof diagnosticsForServerLog>;
  outcome: string;
}): void {
  // Deliberately excludes buyer text, image data, provider output, and secrets.
  console.info(`tech_pack_generation ${JSON.stringify(event)}`);
}

export async function POST(request: Request) {
  const requestId = `req-${randomUUID()}`;
  const startedAt = Date.now();
  let formData: FormData;
  try {
    formData = await readBoundedFormData(request, MAX_MULTIPART_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      logGeneration({ requestId, durationMs: Date.now() - startedAt, outcome: 'image_too_large' });
      return safeErrorResponse(requestId, 'image_too_large', 413);
    }
    logGeneration({ requestId, durationMs: Date.now() - startedAt, outcome: 'invalid_input' });
    return safeErrorResponse(requestId, 'invalid_input', 400);
  }

  const buyerDescription = parseBuyerDescription(formData.get('buyerDescription'));
  if (buyerDescription === null) {
    logGeneration({ requestId, durationMs: Date.now() - startedAt, outcome: 'invalid_input' });
    return safeErrorResponse(requestId, 'invalid_input', 400);
  }

  const upload = formData.get('image');
  if (formData.getAll('image').length !== 1 || !isFileUpload(upload)) {
    logGeneration({ requestId, durationMs: Date.now() - startedAt, outcome: 'invalid_input' });
    return safeErrorResponse(requestId, 'invalid_input', 400);
  }

  const imageValidation = validateImageBytes({
    bytes: new Uint8Array(await upload.arrayBuffer()),
    mimeType: upload.type,
    filename: upload.name,
  });
  if (!imageValidation.success) {
    logGeneration({ requestId, durationMs: Date.now() - startedAt, outcome: imageValidation.code });
    return safeErrorResponse(
      requestId,
      imageValidation.code,
      imageValidation.code === 'image_too_large' ? 413 : 415,
    );
  }

  let configuration: AiRuntimeConfiguration | null = null;
  const diagnostics = createSafeGenerationDiagnostics();
  try {
    configuration = getAiRuntimeConfiguration();
    const result = await generateTechPack(createTechPackProvider(configuration), {
      requestId,
      buyerDescription,
      model: configuration.model,
      image: imageValidation.data,
      diagnostics,
    });
    logGeneration({
      requestId,
      provider: configuration.provider,
      model: result.model,
      durationMs: Date.now() - startedAt,
      repairUsed: result.repairUsed,
      diagnostics: { ...diagnosticsForServerLog(diagnostics), finalErrorCategory: 'success' },
      outcome: 'success',
    });
    return NextResponse.json({
      requestId: result.requestId,
      techPack: result.techPack,
      generation: {
        provider: configuration.provider,
        model: result.model,
        promptVersion: result.techPack.metadata.promptVersion,
        repairUsed: result.repairUsed,
      },
    });
  } catch (error) {
    const code = classifyGenerationFailure(error);
    diagnostics.finalErrorCategory = code;
    if (
      error instanceof MissingOpenAiConfigurationError
      || error instanceof MissingOpenRouterConfigurationError
      || error instanceof MissingGeminiConfigurationError
    ) {
      console.warn('tech_pack_generation_config_missing', { requestId });
    }
    if (error instanceof OpenAiProviderError) {
      console.warn('tech_pack_provider_http_error', {
        provider: 'openai',
        model: configuration?.model,
        status: error.status,
        openAiCode: error.openAiCode,
        openAiType: error.openAiType,
        requestId: error.openAiRequestId,
        durationMs: Date.now() - startedAt,
        repairUsed: null,
      });
    }
    if (error instanceof OpenRouterProviderError) {
      console.warn('tech_pack_provider_http_error', {
        provider: 'openrouter',
        model: configuration?.model,
        status: error.status,
        openRouterCode: error.openRouterCode,
        requestId: error.openRouterRequestId,
        durationMs: Date.now() - startedAt,
        repairUsed: null,
      });
    }
    if (error instanceof GeminiProviderError) {
      console.warn('tech_pack_provider_http_error', {
        provider: 'gemini',
        model: configuration?.model,
        status: error.status,
        durationMs: Date.now() - startedAt,
        repairUsed: null,
      });
    }
    logGeneration({
      requestId,
      provider: configuration?.provider,
      model: configuration?.model,
      durationMs: Date.now() - startedAt,
      repairUsed: null,
      diagnostics: diagnosticsForServerLog(diagnostics),
      outcome: code,
    });
    const status = code === 'provider_timeout' ? 504 : code === 'provider_rate_limit' ? 429 : 502;
    return safeErrorResponse(requestId, code, status);
  }
}
