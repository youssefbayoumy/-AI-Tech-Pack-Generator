import { randomUUID } from 'node:crypto';

import {
  TECH_PACK_SCHEMA_VERSION,
  type GenerationInput,
  type TechPackDocument,
  type TechPackContent,
} from '../../domain/tech-pack';
import { validateModelTechPackOutput } from './validation-pipeline';
import {
  buildTechPackGenerationInput,
  TECH_PACK_GENERATION_PROMPT_VERSION,
} from './prompts/tech-pack-generation';
import { buildTechPackRepairInput } from './prompts/tech-pack-repair';
import type { ProviderImage, ProviderResult, TechPackProvider } from './provider/types';
import type { OpenAiModel } from './config';

export interface GenerateTechPackServiceInput {
  requestId?: string;
  buyerDescription: string;
  image: ProviderImage & {
    filename: string;
    width: number;
    height: number;
    fingerprint: string;
  };
  model: OpenAiModel;
}

export interface GenerateTechPackServiceResult {
  requestId: string;
  techPack: TechPackDocument;
  model: OpenAiModel;
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

/**
 * Runs the canonical output pipeline and has one, and only one, bounded repair
 * opportunity for a model-output schema or semantic validation failure.
 */
export async function generateTechPack(
  provider: TechPackProvider,
  input: GenerateTechPackServiceInput,
): Promise<GenerateTechPackServiceResult> {
  const requestId = input.requestId ?? `req-${randomUUID()}`;
  const buyerEvidence = generationInputFrom(input);
  const generation = await provider.generate({
    prompt: buildTechPackGenerationInput({
      buyerDescription: buyerEvidence.buyerDescription,
      image: buyerEvidence.image,
    }),
    image: input.image,
  });
  if (generation.kind !== 'success') throw providerFailure(generation);

  const initialValidation = validateModelTechPackOutput(generation.output);
  let content: TechPackContent;
  let repairUsed = false;
  if (initialValidation.success) {
    content = initialValidation.data;
  } else {
    repairUsed = true;
    const repair = await provider.repair({
      prompt: buildTechPackRepairInput({
        buyerEvidence,
        previousInvalidOutput: generation.output,
        validationErrors: initialValidation.errors,
      }),
      image: input.image,
    });
    if (repair.kind !== 'success') throw new GenerationServiceError('repair_failed');
    const repairValidation = validateModelTechPackOutput(repair.output);
    if (!repairValidation.success) throw new GenerationServiceError('repair_failed');
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
