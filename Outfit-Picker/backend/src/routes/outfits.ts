import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createOutfitSchema, updateOutfitSchema } from '../validation/outfit';

const router = Router();
const outfitInclude = {
  items: { include: { clothingItem: true }, orderBy: { role: 'asc' as const } },
};

async function findPair(
  topClothingItemId: string,
  bottomClothingItemId: string,
) {
  const items = await prisma.clothingItem.findMany({
    where: { id: { in: [topClothingItemId, bottomClothingItemId] } },
  });
  const top = items.find((item) => item.id === topClothingItemId);
  const bottom = items.find((item) => item.id === bottomClothingItemId);
  if (!top || !bottom || top.category !== 'TOP' || bottom.category !== 'BOTTOM')
    return null;
  return { top, bottom };
}

router.get('/', async (_req, res) => {
  try {
    res.json(
      await prisma.outfit.findMany({
        include: outfitInclude,
        orderBy: { createdAt: 'desc' },
      }),
    );
  } catch {
    res.status(500).json({ message: 'Unable to load outfits.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const outfit = await prisma.outfit.findUnique({
      where: { id: req.params.id },
      include: outfitInclude,
    });
    if (!outfit) return res.status(404).json({ message: 'Outfit not found.' });
    res.json(outfit);
  } catch {
    res.status(500).json({ message: 'Unable to load outfit.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = createOutfitSchema.parse(req.body);
    const pair = await findPair(
      data.topClothingItemId,
      data.bottomClothingItemId,
    );
    if (!pair)
      return res
        .status(400)
        .json({ message: 'An outfit needs one top and one bottom.' });

    const outfit = await prisma.outfit.create({
      data: {
        name: data.name,
        description: data.description || null,
        items: {
          create: [
            { clothingItemId: pair.top.id, role: 'TOP' },
            { clothingItemId: pair.bottom.id, role: 'BOTTOM' },
          ],
        },
      },
      include: outfitInclude,
    });
    res.status(201).json(outfit);
  } catch (error) {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({ message: 'Invalid outfit data.', errors: error.flatten() });
    res.status(500).json({ message: 'Unable to create outfit.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const data = updateOutfitSchema.parse(req.body);
    const existing = await prisma.outfit.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!existing)
      return res.status(404).json({ message: 'Outfit not found.' });

    const topId =
      data.topClothingItemId ??
      existing.items.find((item) => item.role === 'TOP')?.clothingItemId;
    const bottomId =
      data.bottomClothingItemId ??
      existing.items.find((item) => item.role === 'BOTTOM')?.clothingItemId;
    if (!topId || !bottomId || !(await findPair(topId, bottomId))) {
      return res
        .status(400)
        .json({ message: 'An outfit needs one top and one bottom.' });
    }

    const outfit = await prisma.$transaction(async (transaction) => {
      await transaction.outfitItem.deleteMany({
        where: { outfitId: req.params.id },
      });
      return transaction.outfit.update({
        where: { id: req.params.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined
            ? { description: data.description || null }
            : {}),
          items: {
            create: [
              { clothingItemId: topId, role: 'TOP' },
              { clothingItemId: bottomId, role: 'BOTTOM' },
            ],
          },
        },
        include: outfitInclude,
      });
    });
    res.json(outfit);
  } catch (error) {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({ message: 'Invalid outfit data.', errors: error.flatten() });
    res.status(500).json({ message: 'Unable to update outfit.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.outfit.findUnique({
      where: { id: req.params.id },
    });
    if (!existing)
      return res.status(404).json({ message: 'Outfit not found.' });
    await prisma.outfit.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Unable to delete outfit.' });
  }
});

export default router;
