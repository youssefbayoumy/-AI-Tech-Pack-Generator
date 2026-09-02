import { createHash } from 'node:crypto';

import {
  isAcceptedImageMimeType,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  type AcceptedImageMimeType,
} from './policy';

export type ImageValidationFailure = 'unsupported_image' | 'image_too_large';

export interface ValidatedImage {
  bytes: Uint8Array;
  mimeType: AcceptedImageMimeType;
  filename: string;
  width: number;
  height: number;
  fingerprint: string;
}

export type ImageValidationResult =
  | { success: true; data: ValidatedImage }
  | { success: false; code: ImageValidationFailure };

function readUInt24BigEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 16) | (bytes[offset + 1]! << 8) | bytes[offset + 2]!;
}

function readUInt32BigEndian(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! * 2 ** 24) + (bytes[offset + 1]! << 16) + (bytes[offset + 2]! << 8) + bytes[offset + 3]!) >>> 0;
}

function readUInt32LittleEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte)) return null;
  if (String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return null;
  return { width: readUInt32BigEndian(bytes, 16), height: readUInt32BigEndian(bytes, 20) };
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.length) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (bytes[offset + 3]! << 8) | bytes[offset + 4]!,
        width: (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
      };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === 'VP8X') return { width: readUInt24BigEndian(bytes, 24) + 1, height: readUInt24BigEndian(bytes, 27) + 1 };
  if (chunk === 'VP8 ') {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { width: (((bytes[27]! & 0x3f) << 8) | bytes[26]!), height: (((bytes[29]! & 0x3f) << 8) | bytes[28]!) };
  }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) return null;
    const bits = readUInt32LittleEndian(bytes, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function imageDimensions(bytes: Uint8Array, mimeType: AcceptedImageMimeType): { width: number; height: number } | null {
  switch (mimeType) {
    case 'image/png': return pngDimensions(bytes);
    case 'image/jpeg': return jpegDimensions(bytes);
    case 'image/webp': return webpDimensions(bytes);
  }
}

function safeFilename(filename: string): string {
  const basename = filename.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 255);
  return basename.length > 0 ? basename : 'buyer-reference';
}

/** Validates declared type, magic bytes, dimensions, pixels, and byte count. */
export function validateImageBytes(input: {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}): ImageValidationResult {
  if (!isAcceptedImageMimeType(input.mimeType) || input.bytes.byteLength === 0) {
    return { success: false, code: 'unsupported_image' };
  }
  if (input.bytes.byteLength > MAX_IMAGE_BYTES) return { success: false, code: 'image_too_large' };

  const dimensions = imageDimensions(input.bytes, input.mimeType);
  if (dimensions === null || dimensions.width < 1 || dimensions.height < 1) {
    return { success: false, code: 'unsupported_image' };
  }
  if (
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION ||
    dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
  ) {
    return { success: false, code: 'image_too_large' };
  }

  return {
    success: true,
    data: {
      bytes: input.bytes,
      mimeType: input.mimeType,
      filename: safeFilename(input.filename),
      width: dimensions.width,
      height: dimensions.height,
      fingerprint: `sha256:${createHash('sha256').update(input.bytes).digest('hex')}`,
    },
  };
}
