import type { GenerationErrorCode } from './errors';
import { GenerationServiceError } from './generate-tech-pack';

/** Maps provider-facing exceptions to public-safe error categories without exposing SDK details. */
export function classifyGenerationFailure(error: unknown): GenerationErrorCode {
  if (
    typeof error === 'object'
    && error !== null
    && 'status' in error
    && error.status === 429
  ) return 'provider_rate_limit';
  if (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    error.kind === 'timeout'
  ) return 'provider_timeout';
  if (error instanceof GenerationServiceError) return error.code;
  return 'provider_error';
}
