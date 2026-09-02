import {
  validateTechPackContent,
  type TechPackContent,
  type ValidationError,
} from '../../domain/tech-pack';

export type ModelOutputValidationResult =
  | { success: true; data: TechPackContent; errors: [] }
  | { success: false; data: null; errors: ValidationError[] };

/**
 * The provider adapter must call this after Structured Outputs. The canonical
 * helper performs strict Zod parsing first and semantic validation second.
 */
export function validateModelTechPackOutput(rawOutput: unknown): ModelOutputValidationResult {
  return validateTechPackContent(rawOutput, { phase: 'generation' });
}
