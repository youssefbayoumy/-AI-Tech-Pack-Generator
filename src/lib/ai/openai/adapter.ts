import 'server-only';

import OpenAI, { APIError } from 'openai';

import { techPackStructuredOutputFormat } from '../structured-output';
import type {
  GenerateTechPackProviderRequest,
  ProviderResult,
  RepairTechPackProviderRequest,
  TechPackProvider,
} from '../provider/types';
import type { OpenAiRuntimeConfiguration } from '../server-config';

export class OpenAiProviderError extends Error {
  constructor(
    public readonly kind: 'timeout' | 'provider',
    public readonly status: number | null = null,
    public readonly openAiCode: string | null = null,
    public readonly openAiType: string | null = null,
    public readonly openAiRequestId: string | null = null,
  ) {
    super(kind);
    this.name = 'OpenAiProviderError';
  }
}

function imageDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

function hasRefusal(response: { output: Array<{ type: string; content?: Array<{ type: string }> }> }): boolean {
  return response.output.some((item) => item.type === 'message' && item.content?.some((part) => part.type === 'refusal'));
}

function parseResponse(response: {
  status?: string;
  output_text: string;
  output: Array<{ type: string; content?: Array<{ type: string }> }>;
}): ProviderResult {
  if (hasRefusal(response)) return { kind: 'refusal' };
  if (response.status !== 'completed') return { kind: 'incomplete' };
  if (response.output_text.trim().length === 0) return { kind: 'malformed_output' };
  try {
    return { kind: 'success', output: JSON.parse(response.output_text) };
  } catch {
    return { kind: 'malformed_output' };
  }
}

function evidencePayload(evidence: unknown): string {
  return `UNTRUSTED_BUYER_EVIDENCE_JSON\n${JSON.stringify(evidence)}`;
}

function repairPayload(request: RepairTechPackProviderRequest): string {
  return `UNTRUSTED_BUYER_EVIDENCE_JSON\n${JSON.stringify(request.prompt.buyerEvidence)}\n\nPRIOR_INVALID_MODEL_OUTPUT_JSON\n${JSON.stringify(request.prompt.previousInvalidOutput)}\n\nSERVER_VALIDATION_ERRORS_JSON\n${JSON.stringify(request.prompt.validationErrors)}`;
}

/** OpenAI Responses API implementation; SDK response shapes stay inside this file. */
export class OpenAiTechPackProvider implements TechPackProvider {
  private readonly client: OpenAI;

  constructor(private readonly configuration: OpenAiRuntimeConfiguration) {
    this.client = new OpenAI({ apiKey: configuration.apiKey, maxRetries: 0 });
  }

  async generate(request: GenerateTechPackProviderRequest): Promise<ProviderResult> {
    return this.request(
      request.prompt.stableInstructions,
      evidencePayload(request.prompt.buyerEvidence),
      request.image.bytes,
      request.image.mimeType,
    );
  }

  async repair(request: RepairTechPackProviderRequest): Promise<ProviderResult> {
    return this.request(
      request.prompt.stableInstructions,
      repairPayload(request),
      request.image.bytes,
      request.image.mimeType,
    );
  }

  private async request(
    stableInstructions: string,
    untrustedPayload: string,
    imageBytes: Uint8Array,
    mimeType: string,
  ): Promise<ProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.configuration.timeoutMs);
    try {
      const response = await this.client.responses.create(
        {
          model: this.configuration.model,
          reasoning: { effort: this.configuration.reasoningEffort },
          max_output_tokens: this.configuration.maxOutputTokens,
          text: { format: techPackStructuredOutputFormat },
          input: [
            {
              role: 'developer',
              content: [{ type: 'input_text', text: stableInstructions }],
            },
            {
              role: 'user',
              content: [
                { type: 'input_text', text: untrustedPayload },
                {
                  type: 'input_image',
                  image_url: imageDataUrl(imageBytes, mimeType),
                  detail: 'high',
                },
              ],
            },
          ],
        },
        { signal: controller.signal },
      );
      return parseResponse(response);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw new OpenAiProviderError('timeout');
      }
      if (error instanceof APIError) {
        throw new OpenAiProviderError(
          'provider',
          error.status ?? null,
          error.code ?? null,
          error.type ?? null,
          error.requestID ?? null,
        );
      }
      throw new OpenAiProviderError('provider');
    } finally {
      clearTimeout(timeout);
    }
  }
}
