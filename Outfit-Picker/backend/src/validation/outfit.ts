import { z } from 'zod';

export const createOutfitSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    description: z.string().trim().max(800).optional().or(z.literal('')),
    topClothingItemId: z.string().min(1),
    bottomClothingItemId: z.string().min(1),
  })
  .strict();

export const updateOutfitSchema = createOutfitSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    'Provide at least one field to update.',
  );
