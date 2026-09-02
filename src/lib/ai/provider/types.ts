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

export type ProviderResult =
  | { kind: 'success'; output: unknown }
  | { kind: 'refusal' }
  | { kind: 'incomplete' }
  | { kind: 'malformed_output' };

export interface GenerateTechPackProviderRequest {
  prompt: TechPackGenerationRequest;
  image: ProviderImage;
}

export interface RepairTechPackProviderRequest {
  prompt: TechPackRepairRequest;
  image: ProviderImage;
}

/**
 * Application-facing provider boundary. No route or UI code depends on SDK
 * response shapes, and test suites can supply this small deterministic fake.
 */
export interface TechPackProvider {
  generate(request: GenerateTechPackProviderRequest): Promise<ProviderResult>;
  repair(request: RepairTechPackProviderRequest): Promise<ProviderResult>;
}

export interface ValidatedGeneration {
  content: TechPackContent;
  repairUsed: boolean;
  validationErrors: ValidationError[];
}
