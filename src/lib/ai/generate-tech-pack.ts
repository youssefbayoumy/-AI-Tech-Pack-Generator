import { randomUUID } from 'node:crypto';

import {
  TECH_PACK_SCHEMA_VERSION,
  type GenerationInput,
  type TechPackDocument,
  type TechPackContent,
  type ValidationError,
} from '../../domain/tech-pack';
import { techPackContentSchema } from '../../domain/tech-pack/schema';
import { validateModelTechPackOutput } from './validation-pipeline';
import {
  buildTechPackGenerationInput,
  TECH_PACK_GENERATION_PROMPT_VERSION,
} from './prompts/tech-pack-generation';
import { buildTechPackRepairInput } from './prompts/tech-pack-repair';
import { mapGeminiDraftToTechPackContent } from './gemini/map-draft';
import { geminiTechPackDraftSchema } from './gemini/schema';
import type {
  ProviderImage,
  ProviderResult,
  SafeProviderCallDiagnostic,
  TechPackProvider,
} from './provider/types';

export interface SafeGenerationDiagnostics {
  providerCallCount: number;
  providerCalls: SafeProviderCallDiagnostic[];
  validationCalls: Array<{
    attempt: 'initial' | 'repair';
    zod: 'success' | 'failure';
    semantic: 'not_run' | 'success' | 'failure';
  }>;
  zodValidationFailed: boolean;
  zodValidationErrorCount: number;
  semanticValidationFailed: boolean;
  semanticValidationErrorCount: number;
  repairAttempted: boolean;
  finalErrorCategory: string | null;
  compactDraftParse: { initial: 'success' | 'failure' | 'not_attempted'; repair: 'success' | 'failure' | 'not_attempted' };
  canonicalMapping: { initial: 'success' | 'failure' | 'not_attempted'; repair: 'success' | 'failure' | 'not_attempted' };
  semanticErrors: SafeSemanticErrorDiagnostic[];
  compactDraftSummary: {
    initial: SafeCompactDraftSummary | null;
    repair: SafeCompactDraftSummary | null;
  };
}

export interface SafeSemanticErrorDiagnostic {
  attempt: 'initial' | 'repair';
  repairPhase: 'before_repair' | 'after_repair';
  code: string;
  path: string;
  message: string;
}

export interface SafeCompactDraftSummary {
  topLevelKeys: string[];
  bomItems: number;
  measurementSizes: number;
  measurementPoints: number;
  constructionSteps: number;
  evidenceEntries: number;
  productObjectPresent: boolean;
  colorConfigurationObjectPresent: boolean;
}

export function createSafeGenerationDiagnostics(): SafeGenerationDiagnostics {
  return {
    providerCallCount: 0,
    providerCalls: [],
    validationCalls: [],
    zodValidationFailed: false,
    zodValidationErrorCount: 0,
    semanticValidationFailed: false,
    semanticValidationErrorCount: 0,
    repairAttempted: false,
    finalErrorCategory: null,
    compactDraftParse: { initial: 'not_attempted', repair: 'not_attempted' },
    canonicalMapping: { initial: 'not_attempted', repair: 'not_attempted' },
    semanticErrors: [],
    compactDraftSummary: { initial: null, repair: null },
  };
}

function shortDiagnosticMessage(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function semanticErrorDiagnostics(
  errors: ValidationError[],
  attempt: 'initial' | 'repair',
): SafeSemanticErrorDiagnostic[] {
  return errors.map((validationError) => ({
    attempt,
    repairPhase: attempt === 'initial' ? 'before_repair' : 'after_repair',
    code: shortDiagnosticMessage(validationError.code),
    path: shortDiagnosticMessage(validationError.path),
    message: shortDiagnosticMessage(validationError.message),
  }));
}

function compactDraftDiagnostic(output: unknown): SafeCompactDraftSummary | null {
  const parsed = geminiTechPackDraftSchema.safeParse(output);
  if (!parsed.success) return null;
  const draft = parsed.data;
  return {
    topLevelKeys: Object.keys(draft).sort(),
    bomItems: draft.bom?.length ?? 0,
    measurementSizes: draft.measurements?.sizes?.length ?? 0,
    measurementPoints: draft.measurements?.points?.length ?? 0,
    constructionSteps: draft.construction?.length ?? 0,
    evidenceEntries: draft.evidence?.length ?? 0,
    productObjectPresent: draft.product !== undefined,
    colorConfigurationObjectPresent: draft.colorConfiguration !== undefined,
  };
}

/** Excludes local-only semantic and compact-draft details from server logs. */
export function diagnosticsForServerLog(diagnostics: SafeGenerationDiagnostics) {
  const { semanticErrors: _semanticErrors, compactDraftSummary: _compactDraftSummary, ...safeDiagnostics } = diagnostics;
  return safeDiagnostics;
}

export interface GenerateTechPackServiceInput {
  requestId?: string;
  buyerDescription: string;
  image: ProviderImage & {
    filename: string;
    width: number;
    height: number;
    fingerprint: string;
  };
  model: string;
  diagnostics?: SafeGenerationDiagnostics;
}

export interface GenerateTechPackServiceResult {
  requestId: string;
  techPack: TechPackDocument;
  model: string;
  repairUsed: boolean;
}

export class GenerationServiceError extends Error {
  constructor(
    public readonly code:
      | 'provider_error'
      | 'provider_timeout'
      | 'malformed_output'
      | 'semantic_validation_failed'
      | 'repair_failed',
  ) {
    super(code);
    this.name = 'GenerationServiceError';
  }
}

function generationInputFrom(input: GenerateTechPackServiceInput): GenerationInput {
  return {
    buyerDescription: input.buyerDescription,
    image: {
      evidenceId: 'reference-image',
      filename: input.image.filename,
      mimeType: input.image.mimeType,
      byteSize: input.image.bytes.byteLength,
      width: input.image.width,
      height: input.image.height,
    },
    evidence: [
      {
        id: 'buyer-description',
        kind: 'buyer_text',
        text: input.buyerDescription,
      },
      {
        id: 'reference-image',
        kind: 'reference_image_visual',
        text: 'One buyer-supplied reference image. Intentional annotations and visible product features require separate evidence classification.',
      },
    ],
  };
}

function providerFailure(result: Exclude<ProviderResult, { kind: 'success' }>): GenerationServiceError {
  switch (result.kind) {
    case 'malformed_output': return new GenerationServiceError('malformed_output');
    case 'incomplete': return new GenerationServiceError('provider_error');
    case 'refusal': return new GenerationServiceError('provider_error');
  }
}

function validateWithSafeDiagnostics(
  output: unknown,
  attempt: 'initial' | 'repair',
  diagnostics: SafeGenerationDiagnostics | undefined,
) {
  const zod = techPackContentSchema.safeParse(output);
  const validation = validateModelTechPackOutput(output);
  diagnostics?.validationCalls.push({
    attempt,
    zod: zod.success ? 'success' : 'failure',
    semantic: !zod.success ? 'not_run' : validation.success ? 'success' : 'failure',
  });
  if (!validation.success && diagnostics !== undefined) {
    if (!zod.success) {
      diagnostics.zodValidationFailed = true;
      diagnostics.zodValidationErrorCount += validation.errors.length;
    } else {
      diagnostics.semanticValidationFailed = true;
      diagnostics.semanticValidationErrorCount += validation.errors.length;
      diagnostics.semanticErrors.push(...semanticErrorDiagnostics(validation.errors, attempt));
    }
  }
  return validation;
}

function canonicalOutput(
  provider: TechPackProvider,
  output: unknown,
  buyerDescription: string,
  attempt: 'initial' | 'repair',
  diagnostics?: SafeGenerationDiagnostics,
): unknown {
  if (provider.outputFormat !== 'gemini_draft') return output;
  // This is diagnostic state only; mapGeminiDraftToTechPackContent remains the
  // sole production mapper and canonical validation remains authoritative.
  if (diagnostics !== undefined) {
    diagnostics.compactDraftSummary[attempt] = compactDraftDiagnostic(output);
    diagnostics.compactDraftParse[attempt] = 'failure';
    diagnostics.canonicalMapping[attempt] = 'failure';
  }
  try {
    const mapped = mapGeminiDraftToTechPackContent(output, buyerDescription);
    if (diagnostics !== undefined) {
      diagnostics.compactDraftParse[attempt] = 'success';
      diagnostics.canonicalMapping[attempt] = 'success';
    }
    return mapped;
  } catch {
    // Let the existing canonical Zod failure drive the single bounded repair.
    return output;
  }
}

/**
 * Runs the canonical output pipeline and has one, and only one, bounded repair
 * opportunity for a model-output schema or semantic validation failure.
 */
export async function generateTechPack(
  provider: TechPackProvider,
  input: GenerateTechPackServiceInput,
): Promise<GenerateTechPackServiceResult> {
  const requestId = input.requestId ?? `req-${randomUUID()}`;
  const recordDiagnostic = (diagnostic: SafeProviderCallDiagnostic) => {
    input.diagnostics?.providerCalls.push(diagnostic);
  };
  const buyerEvidence = generationInputFrom(input);
  if (input.diagnostics !== undefined) input.diagnostics.providerCallCount += 1;
  const generation = await provider.generate({
    prompt: buildTechPackGenerationInput({
      buyerDescription: buyerEvidence.buyerDescription,
      image: buyerEvidence.image,
    }),
    image: input.image,
    recordDiagnostic,
  });
  if (generation.kind !== 'success') {
    const failure = providerFailure(generation);
    if (input.diagnostics !== undefined) input.diagnostics.finalErrorCategory = failure.code;
    throw failure;
  }

  const initialValidation = validateWithSafeDiagnostics(
    canonicalOutput(provider, generation.output, input.buyerDescription, 'initial', input.diagnostics),
    'initial',
    input.diagnostics,
  );
  let content: TechPackContent;
  let repairUsed = false;
  if (initialValidation.success) {
    content = initialValidation.data;
  } else {
    repairUsed = true;
    if (input.diagnostics !== undefined) {
      input.diagnostics.repairAttempted = true;
      input.diagnostics.providerCallCount += 1;
    }
    const repair = await provider.repair({
      prompt: buildTechPackRepairInput({
        buyerEvidence,
        previousInvalidOutput: generation.output,
        validationErrors: initialValidation.errors,
      }),
      image: input.image,
      recordDiagnostic,
    });
    if (repair.kind !== 'success') {
      if (input.diagnostics !== undefined) input.diagnostics.finalErrorCategory = 'repair_failed';
      throw new GenerationServiceError('repair_failed');
    }
    const repairValidation = validateWithSafeDiagnostics(
      canonicalOutput(provider, repair.output, input.buyerDescription, 'repair', input.diagnostics),
      'repair',
      input.diagnostics,
    );
    if (!repairValidation.success) {
      if (input.diagnostics !== undefined) input.diagnostics.finalErrorCategory = 'repair_failed';
      throw new GenerationServiceError('repair_failed');
    }
    content = repairValidation.data;
  }

  return {
    requestId,
    model: input.model,
    repairUsed,
    techPack: {
      metadata: {
        schemaVersion: TECH_PACK_SCHEMA_VERSION,
        promptVersion: TECH_PACK_GENERATION_PROMPT_VERSION,
        generatedAt: new Date().toISOString(),
        documentId: `tp-${randomUUID()}`,
        imageFingerprint: input.image.fingerprint,
        lifecycleStatus: 'draft_not_approved_for_production',
      },
      content,
    },
  };
}
