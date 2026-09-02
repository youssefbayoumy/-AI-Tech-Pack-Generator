export const generationErrorCodes = [
  'invalid_input',
  'unsupported_image',
  'image_too_large',
  'provider_rate_limit',
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
  invalid_input: { code: 'invalid_input', message: 'Add a product image and description before generating.', retryable: false },
  unsupported_image: { code: 'unsupported_image', message: 'Use a JPEG, PNG, or WebP image.', retryable: false },
  image_too_large: { code: 'image_too_large', message: 'This image is too large to process. Try a smaller image.', retryable: false },
  provider_rate_limit: { code: 'provider_rate_limit', message: 'AI service rate limit reached. Please try again shortly.', retryable: true },
  provider_error: { code: 'provider_error', message: 'The AI service is temporarily unavailable. Please try again shortly.', retryable: true },
  provider_timeout: { code: 'provider_timeout', message: 'Generation took too long. Try again.', retryable: true },
  malformed_output: { code: 'malformed_output', message: 'The draft could not be read. Try again.', retryable: true },
  semantic_validation_failed: { code: 'semantic_validation_failed', message: 'The draft did not meet validation rules. Try again.', retryable: true },
  repair_failed: { code: 'repair_failed', message: 'The draft could not be repaired safely. Try again.', retryable: true },
};
