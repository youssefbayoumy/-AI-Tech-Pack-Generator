export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AcceptedImageMimeType = (typeof ACCEPTED_IMAGE_MIME_TYPES)[number];

export const MAX_IMAGE_BYTES = 3_000_000;
export const MAX_MULTIPART_BYTES = 3_250_000;
export const MAX_IMAGE_DIMENSION = 3_000;
export const MAX_IMAGE_PIXELS = 12_000_000;
export const CLIENT_MAX_IMAGE_DIMENSION = 2_300;
export const CLIENT_TARGET_IMAGE_BYTES = 2_800_000;

export function isAcceptedImageMimeType(value: string): value is AcceptedImageMimeType {
  return (ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}
