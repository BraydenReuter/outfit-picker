import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  createClothingSchema,
  clothingQuerySchema,
  isTypeForCategory,
  updateClothingSchema,
  clothingTypeEnum,
  colorEnum,
  clothingCategoryEnum,
} from '../validation/clothing';
import { deleteProcessedImage, imageExists } from '../services/imageStorage';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const query = clothingQuerySchema.parse(req.query);
    const term = query.search?.toUpperCase().replace(/[\s-]+/g, '_');
    const items = await prisma.clothingItem.findMany({
      where: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.color ? { color: query.color } : {}),
        ...(query.brand ? { brand: { contains: query.brand } } : {}),
        ...(query.size ? { size: { equals: query.size } } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search } },
                { brand: { contains: query.search } },
                { description: { contains: query.search } },
                { size: { contains: query.search } },
                {
                  type: {
                    in: clothingTypeEnum.filter((value) =>
                      value.includes(term!),
                    ),
                  },
                },
                {
                  color: {
                    in: colorEnum.filter((value) => value.includes(term!)),
                  },
                },
                {
                  category: {
                    in: clothingCategoryEnum.filter((value) =>
                      value.includes(term!),
                    ),
                  },
                },
              ],
            }
          : {}),
      },
      orderBy:
        query.sort === 'oldest'
          ? { createdAt: 'asc' }
          : query.sort === 'name-asc'
            ? { name: 'asc' }
            : query.sort === 'name-desc'
              ? { name: 'desc' }
              : { createdAt: 'desc' },
    });
    res.json(items);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: 'Invalid query parameters', errors: error.flatten() });
    }

    res.status(500).json({ message: 'Unable to load clothing items.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.clothingItem.findUnique({
      where: { id: req.params.id },
    });
    if (!item) {
      return res.status(404).json({ message: 'Clothing item not found.' });
    }

    res.json(item);
  } catch {
    res.status(500).json({ message: 'Unable to load clothing item.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = createClothingSchema.parse(req.body);
    if (!(await imageExists(data.imageUrl)))
      return res
        .status(400)
        .json({
          message:
            'That photo is no longer available. Please process it again.',
        });
    const item = await prisma.clothingItem.create({
      data: {
        ...data,
        brand: data.brand || null,
        size: data.size || null,
        imageUrl: data.imageUrl || null,
        description: data.description || null,
      },
    });
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: 'Invalid clothing data.', errors: error.flatten() });
    }

    res.status(500).json({ message: 'Unable to create clothing item.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const data = updateClothingSchema.parse(req.body);
    const existing = await prisma.clothingItem.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Clothing item not found.' });
    }

    if (!(await imageExists(data.imageUrl)))
      return res
        .status(400)
        .json({
          message:
            'That photo is no longer available. Please process it again.',
        });
    if (
      data.category &&
      data.category !== existing.category &&
      (await prisma.outfitItem.count({
        where: { clothingItemId: existing.id },
      }))
    ) {
      return res
        .status(409)
        .json({
          message:
            'This piece is used in a saved outfit. Remove those outfits before changing its category.',
        });
    }
    const category = data.category ?? existing.category;
    const type = data.type ?? existing.type;
    if (!isTypeForCategory(category, type)) {
      return res.status(400).json({ message: 'Type does not match category.' });
    }

    const updated = await prisma.clothingItem.update({
      where: { id: req.params.id },
      data: {
        ...data,
        brand: data.brand !== undefined ? data.brand || null : existing.brand,
        size: data.size !== undefined ? data.size || null : existing.size,
        imageUrl:
          data.imageUrl !== undefined
            ? data.imageUrl || null
            : existing.imageUrl,
        description:
          data.description !== undefined
            ? data.description || null
            : existing.description,
      },
    });

    if (existing.imageUrl !== updated.imageUrl) {
      await deleteProcessedImage(existing.imageUrl);
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: 'Invalid clothing data.', errors: error.flatten() });
    }

    res.status(500).json({ message: 'Unable to update clothing item.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const found = await prisma.clothingItem.findUnique({
      where: { id: req.params.id },
    });
    if (!found) {
      return res.status(404).json({ message: 'Clothing item not found.' });
    }

    // Delete the whole outfit so a missing shirt cannot leave half a saved look.
    await prisma.$transaction(async (transaction) => {
      await transaction.outfit.deleteMany({
        where: { items: { some: { clothingItemId: found.id } } },
      });
      await transaction.clothingItem.delete({ where: { id: found.id } });
    });
    await deleteProcessedImage(found.imageUrl);
    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Unable to delete clothing item.' });
  }
});

export default router;
