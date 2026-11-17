// Runs background removal on the visitor's own device, so the server never needs
// a GPU or a machine-learning runtime. The model (~40 MB) downloads on first use
// and the browser caches it after that.
const MAX_RESULT_EDGE = 1200;

export type RemovalProgress = (message: string) => void;

export async function removeBackgroundInBrowser(
  photo: Blob,
  onProgress?: RemovalProgress,
): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal');
  let downloading = false;
  const cutout = await removeBackground(photo, {
    model: 'isnet_fp16',
    output: { format: 'image/png' },
    ...(import.meta.env.VITE_BACKGROUND_MODEL_URL
      ? { publicPath: import.meta.env.VITE_BACKGROUND_MODEL_URL }
      : {}),
    progress: (key, current, total) => {
      if (!key.startsWith('fetch:') || !total) return;
      if (current < total) downloading = true;
      if (downloading)
        onProgress?.(
          `Downloading the background removal model (first time only)… ${Math.round(
            (current / total) * 100,
          )}%`,
        );
    },
  });
  onProgress?.('Removing the background…');
  return cropTransparentMargins(cutout);
}

/** Trims empty space around the garment and keeps the stored photo small. */
async function cropTransparentMargins(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const source = document.createElement('canvas');
  source.width = bitmap.width;
  source.height = bitmap.height;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) throw new Error('Unable to read the processed photo.');
  sourceContext.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data, width, height } = sourceContext.getImageData(
    0,
    0,
    source.width,
    source.height,
  );
  let top = height,
    left = width,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Ignore faint haze the model leaves around edges.
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0)
    throw new Error(
      'No clothing was found in this photo. Try a photo with more contrast.',
    );

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const scale = Math.min(1, MAX_RESULT_EDGE / Math.max(cropWidth, cropHeight));
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(cropWidth * scale));
  output.height = Math.max(1, Math.round(cropHeight * scale));
  const outputContext = output.getContext('2d');
  if (!outputContext) throw new Error('Unable to prepare the processed photo.');
  outputContext.drawImage(
    source,
    left,
    top,
    cropWidth,
    cropHeight,
    0,
    0,
    output.width,
    output.height,
  );
  return new Promise((resolve, reject) =>
    output.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Unable to prepare the processed photo.')),
      'image/png',
    ),
  );
}
