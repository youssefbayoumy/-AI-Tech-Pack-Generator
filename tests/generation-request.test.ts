import { describe, expect, it } from 'vitest';

import { classifyGenerationFailure } from '../src/lib/ai/failure-classification';
import { GenerationServiceError } from '../src/lib/ai/generate-tech-pack';
import {
  isFileUpload,
  MAX_BUYER_DESCRIPTION_LENGTH,
  parseBuyerDescription,
  readBoundedFormData,
  RequestBodyTooLargeError,
} from '../src/lib/ai/request-validation';

describe('generation request guardrails', () => {
  it('requires a meaningful trimmed buyer description with a hard length limit', () => {
    expect(parseBuyerDescription(null)).toBeNull();
    expect(parseBuyerDescription('  ')).toBeNull();
    expect(parseBuyerDescription('hi')).toBeNull();
    expect(parseBuyerDescription('  bucket hat  ')).toBe('bucket hat');
    expect(parseBuyerDescription('a'.repeat(MAX_BUYER_DESCRIPTION_LENGTH + 1))).toBeNull();
  });

  it('requires one real file entry rather than accepting string form values', () => {
    expect(isFileUpload(null)).toBe(false);
    expect(isFileUpload('reference.png')).toBe(false);
    expect(isFileUpload({ arrayBuffer: async () => new ArrayBuffer(0) } as File)).toBe(true);
  });

  it('enforces the multipart payload limit even without a Content-Length header', async () => {
    const formData = new FormData();
    formData.set('buyerDescription', 'bucket hat');
    const request = new Request('http://localhost/api/tech-packs/generate', {
      method: 'POST',
      body: formData,
    });

    await expect(readBoundedFormData(request, 1)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it('maps provider timeouts and service failures to safe public categories', () => {
    expect(classifyGenerationFailure({ kind: 'timeout' })).toBe('provider_timeout');
    expect(classifyGenerationFailure({ kind: 'provider', status: 429 })).toBe('provider_rate_limit');
    expect(classifyGenerationFailure({ kind: 'provider', status: 503 })).toBe('provider_error');
    expect(classifyGenerationFailure(new GenerationServiceError('repair_failed'))).toBe('repair_failed');
    expect(classifyGenerationFailure(new Error('sdk internals'))).toBe('provider_error');
  });
});
