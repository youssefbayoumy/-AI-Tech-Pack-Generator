import 'server-only';

import { GoogleGenAI } from '@google/genai';

import { geminiTechPackDraftJsonSchema } from './schema';
import type {
  GenerateTechPackProviderRequest,
  ProviderDiagnosticRecorder,
  ProviderResult,
  RepairTechPackProviderRequest,
  SafeProviderCallDiagnostic,
  TechPackProvider,
} from '../provider/types';
import type { GeminiRuntimeConfiguration } from '../server-config';

interface GeminiInteraction {
  status?: unknown;
  output_text?: unknown;
  model?: unknown;
  errors?: Array<{ code?: unknown }>;
  usage?: {
    total_input_tokens?: unknown;
    total_output_tokens?: unknown;
    total_tokens?: unknown;
    total_thought_tokens?: unknown;
  };
  sdkHttpResponse?: { responseInternal?: { status?: unknown } };
}

interface GeminiInteractionClient {
  interactions: {
    create(request: unknown, options?: unknown): Promise<GeminiInteraction>;
  };
}

interface SafeGeminiErrorDetails {
  httpStatus: number | null;
  sdkErrorName: string | null;
  providerErrorCode: string | null;
  providerErrorStatus: string | null;
  timeoutOrAbort: boolean;
  requestValidationError: boolean;
}

export class GeminiProviderError extends Error {
  constructor(
    public readonly kind: 'timeout' | 'provider',
    public readonly status: number | null = null,
    public readonly sdkErrorName: string | null = null,
    public readonly providerErrorCode: string | null = null,
    public readonly providerErrorStatus: string | null = null,
    public readonly requestValidationError = false,
  ) {
    super(kind);
    this.name = 'GeminiProviderError';
  }
}

function evidencePayload(evidence: unknown): string {
  return `UNTRUSTED_BUYER_EVIDENCE_JSON\n${JSON.stringify(evidence)}`;
}

function repairPayload(request: RepairTechPackProviderRequest): string {
  return `UNTRUSTED_BUYER_EVIDENCE_JSON\n${JSON.stringify(request.prompt.buyerEvidence)}\n\nPRIOR_INVALID_MODEL_OUTPUT_JSON\n${JSON.stringify(request.prompt.previousInvalidOutput)}\n\nSERVER_VALIDATION_ERRORS_JSON\n${JSON.stringify(request.prompt.validationErrors)}`;
}

function safeTokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeMetadata(value: unknown, maximumLength: number): string | null {
  return typeof value === 'string'
    && value.length <= maximumLength
    && /^[A-Za-z0-9][A-Za-z0-9 ._:+/-]*$/.test(value)
    ? value
    : null;
}

function safeHttpStatus(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}

function unknownRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function safeErrorCode(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  return safeMetadata(value, 100);
}

export function safeGeminiErrorDetails(error: unknown): SafeGeminiErrorDetails {
  const top = unknownRecord(error);
  const nested = unknownRecord(top?.error);
  const cause = unknownRecord(top?.cause);
  const sdkErrorName = safeMetadata(top?.name, 100)
    ?? safeMetadata(cause?.name, 100);
  const httpStatus = safeHttpStatus(top?.status)
    ?? safeHttpStatus(top?.statusCode)
    ?? safeHttpStatus(unknownRecord(top?.response)?.status)
    ?? safeHttpStatus(unknownRecord(top?.rawResponse)?.status)
    ?? safeHttpStatus(cause?.status)
    ?? safeHttpStatus(cause?.statusCode);
  const providerErrorCode = safeErrorCode(nested?.code)
    ?? safeErrorCode(top?.code)
    ?? safeErrorCode(unknownRecord(cause?.error)?.code);
  const providerErrorStatus = safeMetadata(nested?.status, 100)
    ?? safeMetadata(top?.statusText, 100)
    ?? safeMetadata(unknownRecord(cause?.error)?.status, 100);
  const timeoutOrAbort = new Set([
    'AbortError',
    'APIConnectionTimeoutError',
    'APIUserAbortError',
    'RequestAbortedError',
    'RequestTimeoutError',
  ]).has(sdkErrorName ?? '');
  const requestValidationError = httpStatus === 400
    || httpStatus === 422
    || providerErrorStatus === 'INVALID_ARGUMENT'
    || providerErrorCode === 'invalid_request'
    || sdkErrorName === 'BadRequestError'
    || sdkErrorName === 'InvalidRequestError'
    || sdkErrorName === 'UnprocessableEntityError';

  return {
    httpStatus,
    sdkErrorName,
    providerErrorCode,
    providerErrorStatus,
    timeoutOrAbort,
    requestValidationError,
  };
}

export function geminiImageInput(data: Uint8Array, mimeType: string) {
  return {
    type: 'image' as const,
    mime_type: mimeType,
    data: Buffer.from(data).toString('base64'),
  };
}

export function geminiJsonResponseFormat(schema: Record<string, unknown>) {
  return {
    type: 'text' as const,
    mime_type: 'application/json' as const,
    schema,
  };
}

export function geminiRequestOptions(timeoutMs: number) {
  return { timeout: timeoutMs, maxRetries: 0 };
}

function failedCallDiagnostic(
  attempt: 'initial' | 'repair',
  error: SafeGeminiErrorDetails,
): SafeProviderCallDiagnostic {
  return {
    attempt,
    httpStatus: error.httpStatus,
    choicesLength: null,
    firstChoicePresent: false,
    finishReason: null,
    nativeFinishReason: null,
    messagePresent: false,
    contentType: 'missing',
    contentLength: null,
    reasoningPresent: false,
    reasoningType: 'missing',
    reasoningLength: null,
    reasoningDetailsPresent: false,
    reasoningDetailsType: 'missing',
    reasoningDetailsCount: null,
    refusalPresent: false,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    reasoningTokens: null,
    responseModel: null,
    responseProvider: 'gemini',
    structuredJsonPresent: false,
    jsonParse: 'not_attempted',
    responseFormatRequested: true,
    interactionStatus: null,
    outputPresent: false,
    sdkErrorName: error.sdkErrorName,
    providerErrorCode: error.providerErrorCode,
    providerErrorStatus: error.providerErrorStatus,
    timeoutOrAbort: error.timeoutOrAbort,
    requestValidationError: error.requestValidationError,
  };
}

function diagnostic(
  interaction: GeminiInteraction,
  attempt: 'initial' | 'repair',
  jsonParse: SafeProviderCallDiagnostic['jsonParse'],
): SafeProviderCallDiagnostic {
  const outputText = interaction.output_text;
  const outputPresent = typeof outputText === 'string' && outputText.trim().length > 0;
  return {
    attempt,
    httpStatus: safeHttpStatus(interaction.sdkHttpResponse?.responseInternal?.status),
    choicesLength: null,
    firstChoicePresent: false,
    finishReason: null,
    nativeFinishReason: null,
    messagePresent: false,
    contentType: outputText === undefined ? 'missing' : outputText === null ? 'null'
      : typeof outputText === 'string' ? outputText.length === 0 ? 'empty_string' : 'non_empty_string'
        : Array.isArray(outputText) ? 'array' : typeof outputText === 'object' ? 'object' : 'other',
    contentLength: typeof outputText === 'string' ? outputText.length : null,
    reasoningPresent: false,
    reasoningType: 'missing',
    reasoningLength: null,
    reasoningDetailsPresent: false,
    reasoningDetailsType: 'missing',
    reasoningDetailsCount: null,
    refusalPresent: false,
    promptTokens: safeTokenCount(interaction.usage?.total_input_tokens),
    completionTokens: safeTokenCount(interaction.usage?.total_output_tokens),
    totalTokens: safeTokenCount(interaction.usage?.total_tokens),
    reasoningTokens: safeTokenCount(interaction.usage?.total_thought_tokens),
    responseModel: safeMetadata(interaction.model, 200),
    responseProvider: 'gemini',
    structuredJsonPresent: jsonParse === 'success',
    jsonParse,
    responseFormatRequested: true,
    interactionStatus: safeMetadata(interaction.status, 64),
    outputPresent,
    sdkErrorName: null,
    providerErrorCode: safeErrorCode(interaction.errors?.[0]?.code),
    providerErrorStatus: null,
    timeoutOrAbort: false,
    requestValidationError: false,
  };
}

function parseInteraction(
  interaction: GeminiInteraction,
  attempt: 'initial' | 'repair',
  recordDiagnostic?: ProviderDiagnosticRecorder,
): ProviderResult {
  const outputText = interaction.output_text;
  let parsedOutput: unknown;
  let jsonParse: SafeProviderCallDiagnostic['jsonParse'] = 'not_attempted';
  if (typeof outputText === 'string' && outputText.trim().length > 0) {
    try {
      parsedOutput = JSON.parse(outputText);
      jsonParse = 'success';
    } catch {
      jsonParse = 'failure';
    }
  }
  recordDiagnostic?.(diagnostic(interaction, attempt, jsonParse));

  if (interaction.status !== 'completed') return { kind: 'incomplete' };
  if (typeof outputText !== 'string' || outputText.trim().length === 0 || jsonParse !== 'success') {
    return { kind: 'malformed_output' };
  }
  return { kind: 'success', output: parsedOutput };
}

/** Gemini Interactions API adapter. It intentionally sends no tools or remote-file references. */
export class GeminiTechPackProvider implements TechPackProvider {
  readonly outputFormat = 'gemini_draft' as const;
  private readonly client: GeminiInteractionClient;

  constructor(
    private readonly configuration: GeminiRuntimeConfiguration,
    client?: GeminiInteractionClient,
  ) {
    this.client = client ?? new GoogleGenAI({ apiKey: configuration.apiKey }) as unknown as GeminiInteractionClient;
  }

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
    try {
      const interaction = await this.client.interactions.create({
        model: this.configuration.model,
        store: false,
        system_instruction: stableInstructions,
        generation_config: {
          thinking_level: this.configuration.thinkingLevel,
          max_output_tokens: this.configuration.maxOutputTokens,
        },
        response_format: {
          ...geminiJsonResponseFormat(geminiTechPackDraftJsonSchema),
        },
        input: [
          { type: 'text', text: untrustedPayload },
          geminiImageInput(imageBytes, mimeType),
        ],
      }, geminiRequestOptions(this.configuration.timeoutMs));
      return parseInteraction(interaction, attempt, recordDiagnostic);
    } catch (error) {
      const safeError = safeGeminiErrorDetails(error);
      recordDiagnostic?.(failedCallDiagnostic(attempt, safeError));
      throw new GeminiProviderError(
        safeError.timeoutOrAbort ? 'timeout' : 'provider',
        safeError.httpStatus,
        safeError.sdkErrorName,
        safeError.providerErrorCode,
        safeError.providerErrorStatus,
        safeError.requestValidationError,
      );
    }
  }
}
