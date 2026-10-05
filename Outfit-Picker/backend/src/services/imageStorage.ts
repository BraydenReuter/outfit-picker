import {
  access,
  mkdir,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';

export const uploadsDirectory = process.env.UPLOADS_DIRECTORY
  ? path.resolve(process.env.UPLOADS_DIRECTORY)
  : path.resolve(
      __dirname,
      __filename.endsWith('.ts') ? '../../uploads' : '../../../uploads',
    );
export const localImagePattern = /^\/uploads\/([A-Za-z0-9-]+\.png)$/;

export async function saveProcessedImage(image: Buffer): Promise<string> {
  await mkdir(uploadsDirectory, { recursive: true });
  const filename = `${randomUUID()}.png`;
  await writeFile(path.join(uploadsDirectory, filename), image, { flag: 'wx' });
  return `/uploads/${filename}`;
}

export async function imageExists(
  imageUrl: string | undefined,
): Promise<boolean> {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return true;
  const match = localImagePattern.exec(imageUrl);
  if (!match) return false;
  return access(path.join(uploadsDirectory, match[1])).then(
    () => true,
    () => false,
  );
}

export async function deleteProcessedImage(
  imageUrl: string | null | undefined,
): Promise<void> {
  const match = imageUrl && localImagePattern.exec(imageUrl);
  if (!match) return;
  // Another piece might still be using this photo.
  if (await prisma.clothingItem.count({ where: { imageUrl } })) return;
  try {
    await unlink(path.join(uploadsDirectory, match[1]));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      console.warn('Unable to remove unused photo.', error);
  }
}

export async function cleanupUnusedImages(): Promise<number> {
  await mkdir(uploadsDirectory, { recursive: true });
  let removed = 0;
  for (const filename of await readdir(uploadsDirectory)) {
    const imageUrl = `/uploads/${filename}`;
    if (!localImagePattern.test(imageUrl)) continue;
    const info = await stat(path.join(uploadsDirectory, filename));
    // Leave recent previews alone in case someone is still filling out the form.
    if (Date.now() - info.mtimeMs < 24 * 60 * 60 * 1000) continue;
    if (await prisma.clothingItem.count({ where: { imageUrl } })) continue;
    await deleteProcessedImage(imageUrl);
    removed += 1;
  }
  return removed;
}
