import { config } from '../config/env';

const MAX_RESULT_BYTES = 40 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export class ImageServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 502,
  ) {
    super(message);
    this.name = 'ImageServiceError';
  }
}

export async function removeBackground(
  image: Express.Multer.File,
): Promise<Buffer> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }),
    'clothing-upload',
  );
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.imageProcessingTimeoutMs,
  );

  try {
    const response = await fetch(
      `${config.imageServiceUrl}/remove-background`,
      {
        method: 'POST',
        body: form,
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      if ([400, 413, 415, 422].includes(response.status)) {
        throw new ImageServiceError(
          'Choose a valid JPEG, PNG, or WebP image, up to 10 MB and 25 megapixels.',
          response.status,
        );
      }
      if (response.status === 429)
        throw new ImageServiceError(
          'Another photo is being processed. Try again in a moment.',
          429,
        );
      throw new ImageServiceError(
        'The image processing service rejected the image.',
      );
    }
    if (
      !response.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('image/png') ||
      !response.body
    ) {
      await response.body?.cancel();
      throw new ImageServiceError(
        'The image processing service returned an invalid response.',
      );
    }

    const chunks: Uint8Array[] = [];
    const reader = response.body.getReader();
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESULT_BYTES) {
        await reader.cancel();
        throw new ImageServiceError(
          'The processed photo is too large. Try a smaller photo.',
        );
      }
      chunks.push(value);
    }
    const result = Buffer.concat(chunks);
    // A PNG label is not enough; make sure the service actually sent PNG data.
    if (
      result.length < 45 ||
      !result.subarray(0, 8).equals(PNG_SIGNATURE) ||
      result.toString('ascii', 12, 16) !== 'IHDR' ||
      !result.readUInt32BE(16) ||
      !result.readUInt32BE(20) ||
      result.readUInt32BE(16) * result.readUInt32BE(20) > 25_000_000 ||
      result.toString('ascii', result.length - 8, result.length - 4) !== 'IEND'
    ) {
      throw new ImageServiceError(
        'The image processing service returned an invalid PNG.',
      );
    }
    return result;
  } catch (error) {
    if (error instanceof ImageServiceError) throw error;
    if (controller.signal.aborted)
      throw new ImageServiceError(
        'Image processing timed out. Try a smaller photo.',
        504,
      );
    throw new ImageServiceError('The image processing service is unavailable.');
  } finally {
    clearTimeout(timeout);
  }
}
