export const MAX_BUYER_DESCRIPTION_LENGTH = 5_000;
export const MIN_BUYER_DESCRIPTION_LENGTH = 3;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body exceeds the generation upload limit.');
    this.name = 'RequestBodyTooLargeError';
  }
}

export function parseBuyerDescription(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const description = value.trim();
  if (
    description.length < MIN_BUYER_DESCRIPTION_LENGTH ||
    description.length > MAX_BUYER_DESCRIPTION_LENGTH
  ) return null;
  return description;
}

/** Avoid trusting MIME/name strings and verify that the multipart entry is a file. */
export function isFileUpload(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== 'string' && typeof value.arrayBuffer === 'function';
}

/**
 * Bounds streamed multipart bodies even when a client omits Content-Length.
 * The replacement Request keeps standard multipart parsing while ensuring the
 * route never buffers more than the configured conservative payload maximum.
 */
export async function readBoundedFormData(request: Request, maximumBytes: number): Promise<FormData> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (Number.isFinite(length) && length > maximumBytes) throw new RequestBodyTooLargeError();
  }

  if (request.body === null) throw new TypeError('A multipart request body is required.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  }).formData();
}
