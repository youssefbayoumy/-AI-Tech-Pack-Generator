import { techPackStructuredOutputFormat } from '../structured-output';
import type {
  GenerateTechPackProviderRequest,
  ProviderContentKind,
  ProviderDiagnosticRecorder,
  SafeProviderCallDiagnostic,
  ProviderResult,
  RepairTechPackProviderRequest,
  TechPackProvider,
} from '../provider/types';
import type { OpenRouterRuntimeConfiguration } from '../server-config';

const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

type FetchImplementation = typeof fetch;

export class OpenRouterProviderError extends Error {
  constructor(
    public readonly kind: 'timeout' | 'provider',
    public readonly status: number | null = null,
    public readonly openRouterCode: string | null = null,
    public readonly openRouterRequestId: string | null = null,
  ) {
    super(kind);
    this.name = 'OpenRouterProviderError';
  }
}

function imageDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

function evidencePayload(evidence: unknown): string {
  return `UNTRUSTED_BUYER_EVIDENCE_JSON\n${JSON.stringify(evidence)}`;
}

function repairPayload(request: RepairTechPackProviderRequest): string {
  return `UNTRUSTED_BUYER_EVIDENCE_JSON\n${JSON.stringify(request.prompt.buyerEvidence)}\n\nPRIOR_INVALID_MODEL_OUTPUT_JSON\n${JSON.stringify(request.prompt.previousInvalidOutput)}\n\nSERVER_VALIDATION_ERRORS_JSON\n${JSON.stringify(request.prompt.validationErrors)}`;
}

function responseFormat() {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: techPackStructuredOutputFormat.name,
      strict: techPackStructuredOutputFormat.strict,
      schema: techPackStructuredOutputFormat.schema,
    },
  };
}

function contentKind(content: unknown, present: boolean): ProviderContentKind {
  if (!present) return 'missing';
  if (content === null) return 'null';
  if (typeof content === 'string') return content.length === 0 ? 'empty_string' : 'non_empty_string';
  if (Array.isArray(content)) return 'array';
  if (typeof content === 'object') return 'object';
  return 'other';
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasOwn(value: Record<string, unknown> | null, key: string): boolean {
  return value !== null && Object.prototype.hasOwnProperty.call(value, key);
}

function safeTokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeMetadataString(value: unknown, pattern: RegExp, maximumLength: number): string | null {
  return typeof value === 'string' && value.length <= maximumLength && pattern.test(value)
    ? value
    : null;
}

function safeFinishReason(value: unknown): string | null {
  return safeMetadataString(value, /^[A-Za-z0-9][A-Za-z0-9 ._:+/-]*$/, 64);
}

function safeModelIdentity(value: unknown): string | null {
  return safeMetadataString(value, /^[A-Za-z0-9][A-Za-z0-9._:+/-]*$/, 200);
}

function safeProviderIdentity(value: unknown): string | null {
  return safeMetadataString(value, /^[A-Za-z0-9][A-Za-z0-9 ._:+/()&-]*$/, 100);
}

const TRUNCATION_FINISH_REASONS = new Set([
  'length',
  'max_completion_tokens',
  'max_output_tokens',
  'max_tokens',
  'max_tokens_reached',
  'token_limit',
]);

function isTruncationFinishReason(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_');
  return TRUNCATION_FINISH_REASONS.has(normalized);
}

interface InspectedCompletion {
  responseObject: Record<string, unknown> | null;
  choice: Record<string, unknown> | null;
  message: Record<string, unknown> | null;
  content: unknown;
  parsedOutput: unknown;
  diagnostic: SafeProviderCallDiagnostic;
  finishReasonValue: unknown;
  nativeFinishReasonValue: unknown;
}

function inspectCompletion(
  response: unknown,
  httpStatus: number,
  attempt: 'initial' | 'repair',
): InspectedCompletion {
  const responseObject = record(response);
  const choicesValue = responseObject?.choices;
  const choices = Array.isArray(choicesValue) ? choicesValue : null;
  const firstChoicePresent = choices !== null && choices.length > 0;
  const choice = firstChoicePresent ? record(choices[0]) : null;
  const message = choice === null ? null : record(choice.message);
  const contentPresent = hasOwn(message, 'content');
  const content = contentPresent ? message?.content : undefined;
  const reasoningPresent = hasOwn(message, 'reasoning');
  const reasoning = reasoningPresent ? message?.reasoning : undefined;
  const reasoningDetailsPresent = hasOwn(message, 'reasoning_details');
  const reasoningDetails = reasoningDetailsPresent ? message?.reasoning_details : undefined;
  const finishReasonValue = choice?.finish_reason;
  const nativeFinishReasonValue = choice?.native_finish_reason;
  const usage = responseObject === null ? null : record(responseObject.usage);
  const completionTokenDetails = usage === null ? null : record(usage.completion_tokens_details);
  const outputTokenDetails = usage === null ? null : record(usage.output_tokens_details);
  let parsedOutput: unknown;
  let jsonParse: SafeProviderCallDiagnostic['jsonParse'] = 'not_attempted';
  if (typeof content === 'string' && content.trim().length > 0) {
    try {
      parsedOutput = JSON.parse(content);
      jsonParse = 'success';
    } catch {
      jsonParse = 'failure';
    }
  }

  return {
    responseObject,
    choice,
    message,
    content,
    parsedOutput,
    finishReasonValue,
    nativeFinishReasonValue,
    diagnostic: {
      attempt,
      httpStatus,
      choicesLength: choices?.length ?? null,
      firstChoicePresent,
      finishReason: safeFinishReason(finishReasonValue),
      nativeFinishReason: safeFinishReason(nativeFinishReasonValue),
      messagePresent: message !== null,
      contentType: contentKind(content, contentPresent),
      contentLength: typeof content === 'string' ? content.length : null,
      reasoningPresent,
      reasoningType: contentKind(reasoning, reasoningPresent),
      reasoningLength: typeof reasoning === 'string' ? reasoning.length : null,
      reasoningDetailsPresent,
      reasoningDetailsType: contentKind(reasoningDetails, reasoningDetailsPresent),
      reasoningDetailsCount: Array.isArray(reasoningDetails) ? reasoningDetails.length : null,
      refusalPresent: hasOwn(message, 'refusal') && message?.refusal !== null && message?.refusal !== undefined,
      promptTokens: safeTokenCount(usage?.prompt_tokens),
      completionTokens: safeTokenCount(usage?.completion_tokens),
      totalTokens: safeTokenCount(usage?.total_tokens),
      reasoningTokens: safeTokenCount(
        completionTokenDetails?.reasoning_tokens
          ?? outputTokenDetails?.reasoning_tokens
          ?? usage?.reasoning_tokens,
      ),
      responseModel: safeModelIdentity(responseObject?.model),
      responseProvider: safeProviderIdentity(responseObject?.provider),
      structuredJsonPresent: jsonParse === 'success',
      jsonParse,
      responseFormatRequested: true,
    },
  };
}

function parseCompletion(
  response: unknown,
  httpStatus: number,
  attempt: 'initial' | 'repair',
  recordDiagnostic?: ProviderDiagnosticRecorder,
): ProviderResult {
  const inspected = inspectCompletion(response, httpStatus, attempt);
  recordDiagnostic?.(inspected.diagnostic);

  if (inspected.responseObject === null || inspected.choice === null) return { kind: 'malformed_output' };
  if (inspected.message === null) return { kind: 'malformed_output' };
  if (inspected.diagnostic.refusalPresent) return { kind: 'refusal' };
  if (
    isTruncationFinishReason(inspected.finishReasonValue)
    || isTruncationFinishReason(inspected.nativeFinishReasonValue)
  ) return { kind: 'incomplete' };
  if (
    typeof inspected.content !== 'string'
    || inspected.content.trim().length === 0
    || inspected.diagnostic.jsonParse !== 'success'
  ) {
    return { kind: 'malformed_output' };
  }
  return { kind: 'success', output: inspected.parsedOutput };
}

function safeErrorCode(response: unknown): string | null {
  if (typeof response !== 'object' || response === null || !('error' in response)) return null;
  const error = response.error;
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

/**
 * OpenRouter's OpenAI-compatible chat-completions adapter. It shares the
 * provider-neutral prompt, image bytes, schema, and output pipeline with OpenAI.
 */
export class OpenRouterTechPackProvider implements TechPackProvider {
  constructor(
    private readonly configuration: OpenRouterRuntimeConfiguration,
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {}

  async generate(request: GenerateTechPackProviderRequest): Promise<ProviderResult> {
    return this.request(
      request.prompt.stableInstructions,
      evidencePayload(request.prompt.buyerEvidence),
      request.image.bytes,
      request.image.mimeType,
      'initial',
      request.recordDiagnostic,
    );
  }

  async repair(request: RepairTechPackProviderRequest): Promise<ProviderResult> {
    return this.request(
      request.prompt.stableInstructions,
      repairPayload(request),
      request.image.bytes,
      request.image.mimeType,
      'repair',
      request.recordDiagnostic,
    );
  }

  private async request(
    stableInstructions: string,
    untrustedPayload: string,
    imageBytes: Uint8Array,
    mimeType: string,
    attempt: 'initial' | 'repair',
    recordDiagnostic?: ProviderDiagnosticRecorder,
  ): Promise<ProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.configuration.timeoutMs);
    try {
      const response = await this.fetchImplementation(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.configuration.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.configuration.model,
          max_tokens: this.configuration.maxOutputTokens,
          provider: { require_parameters: true },
          response_format: responseFormat(),
          messages: [
            { role: 'developer', content: stableInstructions },
            {
              role: 'user',
              content: [
                { type: 'text', text: untrustedPayload },
                { type: 'image_url', image_url: { url: imageDataUrl(imageBytes, mimeType) } },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        recordDiagnostic?.(inspectCompletion(payload, response.status, attempt).diagnostic);
        throw new OpenRouterProviderError(
          'provider',
          response.status,
          safeErrorCode(payload),
          response.headers.get('x-request-id') ?? response.headers.get('x-openrouter-request-id'),
        );
      }
      return parseCompletion(payload, response.status, attempt, recordDiagnostic);
    } catch (error) {
      if (error instanceof OpenRouterProviderError) throw error;
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw new OpenRouterProviderError('timeout');
      }
      throw new OpenRouterProviderError('provider');
    } finally {
      clearTimeout(timeout);
    }
  }
}
