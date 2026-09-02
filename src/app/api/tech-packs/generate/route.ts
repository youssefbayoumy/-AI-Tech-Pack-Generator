import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { generationErrorMessages, type GenerationErrorCode } from '../../../../lib/ai/errors';
import { classifyGenerationFailure } from '../../../../lib/ai/failure-classification';
import { generateTechPack } from '../../../../lib/ai/generate-tech-pack';
import { MAX_MULTIPART_BYTES } from '../../../../lib/ai/image/policy';
import { validateImageBytes } from '../../../../lib/ai/image/validate';
import { OpenAiTechPackProvider } from '../../../../lib/ai/openai/adapter';
import {
  isFileUpload,
  parseBuyerDescription,
  readBoundedFormData,
  RequestBodyTooLargeError,
} from '../../../../lib/ai/request-validation';
import {
  getOpenAiRuntimeConfiguration,
  MissingOpenAiConfigurationError,
} from '../../../../lib/ai/server-config';

export const runtime = 'nodejs';

function safeErrorResponse(requestId: string, code: GenerationErrorCode, status: number) {
  return NextResponse.json(
    { requestId, error: generationErrorMessages[code] },
    { status },
  );
}

function logGeneration(event: {
  requestId: string;
  model?: string;
  durationMs: number;
  repairUsed?: boolean;
  outcome: string;
}): void {
  // Deliberately excludes buyer text, image data, provider output, and secrets.
  console.info('tech_pack_generation', event);
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

  try {
    const configuration = getOpenAiRuntimeConfiguration();
    const result = await generateTechPack(new OpenAiTechPackProvider(configuration), {
      requestId,
      buyerDescription,
      model: configuration.model,
      image: imageValidation.data,
    });
    logGeneration({
      requestId,
      model: result.model,
      durationMs: Date.now() - startedAt,
      repairUsed: result.repairUsed,
      outcome: 'success',
    });
    return NextResponse.json({
      requestId: result.requestId,
      techPack: result.techPack,
      generation: {
        model: result.model,
        promptVersion: result.techPack.metadata.promptVersion,
        repairUsed: result.repairUsed,
      },
    });
  } catch (error) {
    const code = classifyGenerationFailure(error);
    if (error instanceof MissingOpenAiConfigurationError) {
      console.warn('tech_pack_generation_config_missing', { requestId });
    }
    logGeneration({ requestId, durationMs: Date.now() - startedAt, outcome: code });
    return safeErrorResponse(requestId, code, code === 'provider_timeout' ? 504 : 502);
  }
}
