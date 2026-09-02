import type {
  GenerationInput,
  TechPackContent,
  ValidationError,
} from '../../../domain/tech-pack';
import type { TechPackGenerationRequest } from '../prompts/tech-pack-generation';
import type { TechPackRepairRequest } from '../prompts/tech-pack-repair';

export interface ProviderImage {
  bytes: Uint8Array;
  mimeType: GenerationInput['image']['mimeType'];
}

export type ProviderContentKind =
  | 'missing'
  | 'null'
  | 'empty_string'
  | 'non_empty_string'
  | 'object'
  | 'array'
  | 'other';

export type ProviderJsonParseResult = 'success' | 'failure' | 'not_attempted';

/** Structural-only telemetry. It excludes prompts, image data, secrets, and model output. */
export interface SafeProviderCallDiagnostic {
  attempt: 'initial' | 'repair';
  httpStatus: number | null;
  choicesLength: number | null;
  firstChoicePresent: boolean;
  finishReason: string | null;
  nativeFinishReason: string | null;
  messagePresent: boolean;
  contentType: ProviderContentKind;
  contentLength: number | null;
  reasoningPresent: boolean;
  reasoningType: ProviderContentKind;
  reasoningLength: number | null;
  reasoningDetailsPresent: boolean;
  reasoningDetailsType: ProviderContentKind;
  reasoningDetailsCount: number | null;
  refusalPresent: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  reasoningTokens: number | null;
  responseModel: string | null;
  responseProvider: string | null;
  structuredJsonPresent: boolean;
  jsonParse: ProviderJsonParseResult;
  responseFormatRequested: boolean;
  interactionStatus?: string | null;
  outputPresent?: boolean;
  sdkErrorName?: string | null;
  providerErrorCode?: string | null;
  providerErrorStatus?: string | null;
  timeoutOrAbort?: boolean;
  requestValidationError?: boolean;
}

export type ProviderDiagnosticRecorder = (diagnostic: SafeProviderCallDiagnostic) => void;

export type ProviderResult =
  | { kind: 'success'; output: unknown }
  | { kind: 'refusal' }
  | { kind: 'incomplete' }
  | { kind: 'malformed_output' };

export interface GenerateTechPackProviderRequest {
  prompt: TechPackGenerationRequest;
  image: ProviderImage;
  recordDiagnostic?: ProviderDiagnosticRecorder;
}

export interface RepairTechPackProviderRequest {
  prompt: TechPackRepairRequest;
  image: ProviderImage;
  recordDiagnostic?: ProviderDiagnosticRecorder;
}

/**
 * Application-facing provider boundary. No route or UI code depends on SDK
 * response shapes, and test suites can supply this small deterministic fake.
 */
export interface TechPackProvider {
  /** Gemini alone emits the compact draft; other providers retain canonical output. */
  outputFormat?: 'canonical' | 'gemini_draft';
  generate(request: GenerateTechPackProviderRequest): Promise<ProviderResult>;
  repair(request: RepairTechPackProviderRequest): Promise<ProviderResult>;
}

export interface ValidatedGeneration {
  content: TechPackContent;
  repairUsed: boolean;
  validationErrors: ValidationError[];
}
