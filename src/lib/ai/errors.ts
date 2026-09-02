export const generationErrorCodes = [
  'invalid_input',
  'unsupported_image',
  'provider_error',
  'provider_timeout',
  'malformed_output',
  'semantic_validation_failed',
  'repair_failed',
] as const;

export type GenerationErrorCode = (typeof generationErrorCodes)[number];

export interface GenerationError {
  code: GenerationErrorCode;
  message: string;
  retryable: boolean;
}

/** Safe UI-facing copy. Future logs should retain codes and IDs, not buyer data. */
export const generationErrorMessages: Record<GenerationErrorCode, GenerationError> = {
  invalid_input: { code: 'invalid_input', message: 'Check the description and try again.', retryable: false },
  unsupported_image: { code: 'unsupported_image', message: 'Use a supported product image and try again.', retryable: false },
  provider_error: { code: 'provider_error', message: 'Generation is temporarily unavailable. Try again.', retryable: true },
  provider_timeout: { code: 'provider_timeout', message: 'Generation took too long. Try again.', retryable: true },
  malformed_output: { code: 'malformed_output', message: 'The draft could not be read. Try again.', retryable: true },
  semantic_validation_failed: { code: 'semantic_validation_failed', message: 'The draft did not meet validation rules. Try again.', retryable: true },
  repair_failed: { code: 'repair_failed', message: 'The draft could not be repaired safely. Try again.', retryable: true },
};
