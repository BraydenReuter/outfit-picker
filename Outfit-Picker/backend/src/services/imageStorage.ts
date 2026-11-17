import { prisma } from '../lib/prisma';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2048;
export const localImagePattern =
  /^\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.png$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

/** Checks the bytes really are a PNG of a sensible size, whatever the upload claims. */
export function assertValidPng(image: Buffer): void {
  if (
    image.length < 45 ||
    !image.subarray(0, 8).equals(PNG_SIGNATURE) ||
    image.toString('ascii', 12, 16) !== 'IHDR' ||
    image.toString('ascii', image.length - 8, image.length - 4) !== 'IEND'
  )
    throw new ImageValidationError('The processed photo must be a PNG image.');
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  if (!width || !height || width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE)
    throw new ImageValidationError(
      `The processed photo must be at most ${MAX_IMAGE_EDGE} pixels on each side.`,
    );
}

export function imageIdFromUrl(imageUrl: string | null | undefined) {
  return imageUrl ? localImagePattern.exec(imageUrl)?.[1] : undefined;
}

export async function saveProcessedImage(image: Buffer): Promise<string> {
  assertValidPng(image);
  const stored = await prisma.storedImage.create({
    data: { data: new Uint8Array(image) },
    select: { id: true },
  });
  return `/uploads/${stored.id}.png`;
}

export async function loadImage(imageUrl: string): Promise<Buffer | null> {
  const id = imageIdFromUrl(imageUrl);
  if (!id) return null;
  const image = await prisma.storedImage.findUnique({ where: { id } });
  return image ? Buffer.from(image.data) : null;
}

/** External https URLs are allowed as-is; local photos must still be stored. */
export async function imageExists(
  imageUrl: string | undefined,
): Promise<boolean> {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return true;
  const id = imageIdFromUrl(imageUrl);
  if (!id) return false;
  return (await prisma.storedImage.count({ where: { id } })) > 0;
}

export async function deleteProcessedImage(
  imageUrl: string | null | undefined,
): Promise<void> {
  const id = imageIdFromUrl(imageUrl);
  if (!id) return;
  // Another piece might still be using this photo.
  if (await prisma.clothingItem.count({ where: { imageUrl } })) return;
  await prisma.storedImage.deleteMany({ where: { id } });
}

/** Removes photos no clothing uses that are older than a day (abandoned previews). */
export async function cleanupUnusedImages(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const used = await prisma.clothingItem.findMany({
    where: { imageUrl: { startsWith: '/uploads/' } },
    select: { imageUrl: true },
  });
  const usedIds = used
    .map((item) => imageIdFromUrl(item.imageUrl))
    .filter((id): id is string => !!id);
  const { count } = await prisma.storedImage.deleteMany({
    where: { createdAt: { lt: cutoff }, id: { notIn: usedIds } },
  });
  return count;
}
