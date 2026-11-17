import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import type {
  ClothingCategory,
  ClothingType,
  ColorName,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';

const demoImageDirectory = path.resolve(
  __dirname,
  __filename.endsWith('.ts')
    ? '../../prisma/demo-images'
    : '../../../prisma/demo-images',
);

type DemoPiece = {
  key: string;
  name: string;
  category: ClothingCategory;
  type: ClothingType;
  color: ColorName;
  brand?: string;
  size?: string;
  description?: string;
};

export const demoPieces: DemoPiece[] = [
  { key: 'white-tee', name: 'Everyday white tee', category: 'TOP', type: 'T_SHIRT', color: 'WHITE', brand: 'Uniqlo', size: 'M', description: 'Heavyweight cotton. Goes with everything.' },
  { key: 'navy-hoodie', name: 'Navy pullover hoodie', category: 'TOP', type: 'HOODIE', color: 'NAVY', brand: 'Champion', size: 'L', description: 'Reverse weave, a little roomy.' },
  { key: 'gray-sweatshirt', name: 'Gray crewneck', category: 'TOP', type: 'SWEATSHIRT', color: 'GRAY', size: 'M' },
  { key: 'green-polo', name: 'Forest polo', category: 'TOP', type: 'POLO', color: 'GREEN', brand: 'Lacoste', size: 'M', description: 'Piqué cotton for warmer days.' },
  { key: 'blue-jeans', name: 'Mid-wash straight jeans', category: 'BOTTOM', type: 'JEANS', color: 'BLUE', brand: "Levi's", size: '32x32' },
  { key: 'beige-chinos', name: 'Stone chinos', category: 'BOTTOM', type: 'CHINOS', color: 'BEIGE', brand: 'J.Crew', size: '32', description: 'Slim fit, slight stretch.' },
  { key: 'black-joggers', name: 'Black joggers', category: 'BOTTOM', type: 'JOGGERS', color: 'BLACK', brand: 'Nike', size: 'M' },
  { key: 'khaki-shorts', name: 'Khaki shorts', category: 'BOTTOM', type: 'SHORTS', color: 'BEIGE', size: '32', description: '7-inch inseam.' },
];

const demoOutfits = [
  { name: 'Weekend errands', description: 'Easy and comfortable.', top: 'navy-hoodie', bottom: 'black-joggers' },
  { name: 'Smart casual', description: 'Works for a dinner out.', top: 'green-polo', bottom: 'beige-chinos' },
  { name: 'Classic', top: 'white-tee', bottom: 'blue-jeans' },
];

/** Replaces everything in the database with the sample wardrobe. */
export async function resetDemoWardrobe(): Promise<void> {
  const images = await Promise.all(
    demoPieces.map((piece) =>
      readFile(path.join(demoImageDirectory, `${piece.key}.png`)),
    ),
  );
  await prisma.$transaction(
    async (tx) => {
      await tx.outfit.deleteMany();
      await tx.clothingItem.deleteMany();
      await tx.storedImage.deleteMany();
      const ids = new Map<string, string>();
      // Oldest first so the default "newest" sort shows the list top-down.
      for (const [index, { key, ...piece }] of demoPieces.entries()) {
        const image = await tx.storedImage.create({
          data: { data: new Uint8Array(images[index]) },
        });
        const item = await tx.clothingItem.create({
          data: {
            ...piece,
            imageUrl: `/uploads/${image.id}.png`,
            createdAt: new Date(Date.now() - (demoPieces.length - index) * 1000),
          },
        });
        ids.set(key, item.id);
      }
      for (const outfit of demoOutfits) {
        await tx.outfit.create({
          data: {
            name: outfit.name,
            description: outfit.description ?? null,
            items: {
              create: [
                { clothingItemId: ids.get(outfit.top)!, role: 'TOP' },
                { clothingItemId: ids.get(outfit.bottom)!, role: 'BOTTOM' },
              ],
            },
          },
        });
      }
      await tx.demoState.upsert({
        where: { id: 1 },
        create: { id: 1, lastResetAt: new Date() },
        update: { lastResetAt: new Date() },
      });
    },
    { timeout: 30_000 },
  );
}

let nextResetAt = 0;
let pending: Promise<void> | null = null;

async function resetIfDue(): Promise<void> {
  const intervalMs = config.demoResetHours * 60 * 60 * 1000;
  const state = await prisma.demoState.findUnique({ where: { id: 1 } });
  const last = state?.lastResetAt.getTime() ?? 0;
  if (Date.now() - last >= intervalMs) {
    await resetDemoWardrobe();
    nextResetAt = Date.now() + intervalMs;
  } else {
    nextResetAt = last + intervalMs;
  }
}

/**
 * Restores the sample wardrobe once it is older than DEMO_RESET_HOURS. Free hosts
 * sleep between visits, so the check runs on incoming requests instead of a timer.
 */
export function demoResetMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (config.demoResetHours <= 0 || Date.now() < nextResetAt) return next();
  pending ??= resetIfDue().finally(() => {
    pending = null;
  });
  pending.then(() => next(), next);
}

export function demoStatus() {
  return config.demoResetHours > 0
    ? { resetHours: config.demoResetHours }
    : null;
}
