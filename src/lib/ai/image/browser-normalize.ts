import {
  CLIENT_MAX_IMAGE_DIMENSION,
  CLIENT_TARGET_IMAGE_BYTES,
  isAcceptedImageMimeType,
} from './policy';

export class BrowserImageNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserImageNormalizationError';
  }
}

async function loadImage(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, draw: bitmap };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new BrowserImageNormalizationError('This image could not be processed.'));
      next.src = url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight, draw: image };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new BrowserImageNormalizationError('This image could not be processed.'));
      else resolve(blob);
    }, mimeType, quality);
  });
}

function normalizedFilename(filename: string, mimeType: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || 'buyer-reference';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return `${base}-normalized.${extension}`;
}

/**
 * Re-encoding strips source metadata and honors EXIF orientation through the
 * browser decoder. Small technical references keep their native dimensions.
 */
export async function normalizeImageForGeneration(file: File): Promise<File> {
  if (!isAcceptedImageMimeType(file.type) || file.size === 0) {
    throw new BrowserImageNormalizationError('Use a JPEG, PNG, or WebP image.');
  }

  let source: { width: number; height: number; draw: CanvasImageSource };
  try {
    source = await loadImage(file);
  } catch (error) {
    if (error instanceof BrowserImageNormalizationError) throw error;
    throw new BrowserImageNormalizationError('This image could not be processed.');
  }
  if (source.width < 1 || source.height < 1) {
    throw new BrowserImageNormalizationError('This image could not be processed.');
  }

  const scale = Math.min(1, CLIENT_MAX_IMAGE_DIMENSION / Math.max(source.width, source.height));
  let width = Math.max(1, Math.round(source.width * scale));
  let height = Math.max(1, Math.round(source.height * scale));
  let outputType = file.type;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) throw new BrowserImageNormalizationError('This image could not be processed.');
    if (outputType === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(source.draw, 0, 0, width, height);

    const qualities = outputType === 'image/jpeg' ? [0.92, 0.86, 0.8] : [undefined];
    for (const quality of qualities) {
      const blob = await toBlob(canvas, outputType, quality);
      if (blob.size <= CLIENT_TARGET_IMAGE_BYTES) {
        return new File([blob], normalizedFilename(file.name, outputType), { type: outputType });
      }
    }

    // Only oversized payloads are converted/reduced. Small annotated boards
    // retain their size and native PNG/WebP encoding where possible.
    outputType = 'image/jpeg';
    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }
  throw new BrowserImageNormalizationError('This image is too large to process. Try a smaller image.');
}
