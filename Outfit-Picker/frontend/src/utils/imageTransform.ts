const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isSupportedImageType(type: string): boolean {
  return supportedImageTypes.has(type);
}

export function normalizeQuarterTurns(turns: number): number {
  return ((turns % 4) + 4) % 4;
}

export async function transformImage(
  file: File,
  quarterTurns = 0,
): Promise<File> {
  if (typeof createImageBitmap === 'undefined') {
    throw new Error('This browser cannot prepare images for processing.');
  }

  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  if (bitmap.width * bitmap.height > 25_000_000) {
    bitmap.close();
    throw new Error('Choose a photo smaller than 25 megapixels.');
  }
  const turns = normalizeQuarterTurns(quarterTurns);
  const swapDimensions = turns % 2 === 1;
  const canvas = document.createElement('canvas');
  // A phone photo does not need its full resolution for a closet thumbnail.
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  canvas.width = swapDimensions ? height : width;
  canvas.height = swapDimensions ? width : height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Unable to prepare the selected image.');
  }

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((turns * Math.PI) / 2);
  context.drawImage(bitmap, -width / 2, -height / 2, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error('Unable to prepare the selected image.')),
      'image/png',
    );
  });

  if (blob.size > 10 * 1024 * 1024)
    throw new Error('The prepared photo is too large. Try a smaller photo.');
  const filename = file.name.replace(/\.[^.]+$/, '') || 'clothing-image';
  return new File([blob], `${filename}.png`, { type: 'image/png' });
}
