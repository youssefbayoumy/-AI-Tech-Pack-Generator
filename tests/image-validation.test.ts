import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { MAX_IMAGE_BYTES } from '../src/lib/ai/image/policy';
import { validateImageBytes } from '../src/lib/ai/image/validate';

describe('server image validation', () => {
  it('accepts the canonical PNG only after checking its signature and dimensions', async () => {
    const bytes = new Uint8Array(await readFile('public/reference/masdr-bucket-hat-reference.png'));
    const result = validateImageBytes({ bytes, mimeType: 'image/png', filename: 'bucket hat.png' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.width).toBeGreaterThan(0);
      expect(result.data.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(result.data.filename).toBe('bucket-hat.png');
    }
  });

  it('rejects invalid MIME data even when a filename looks like an image', () => {
    expect(
      validateImageBytes({
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'image/gif',
        filename: 'reference.png',
      }),
    ).toEqual({ success: false, code: 'unsupported_image' });
  });

  it('rejects oversized payloads before parsing image content', () => {
    expect(
      validateImageBytes({
        bytes: new Uint8Array(MAX_IMAGE_BYTES + 1),
        mimeType: 'image/png',
        filename: 'large.png',
      }),
    ).toEqual({ success: false, code: 'image_too_large' });
  });
});
