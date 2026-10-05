import { z } from 'zod';

export type ClothingCategory = 'TOP' | 'BOTTOM';
export type ClothingType =
  | 'T_SHIRT'
  | 'LONG_SLEEVE'
  | 'HOODIE'
  | 'SWEATSHIRT'
  | 'SWEATER'
  | 'POLO'
  | 'TANK_TOP'
  | 'OTHER_TOP'
  | 'JEANS'
  | 'CHINOS'
  | 'DRESS_PANTS'
  | 'SHORTS'
  | 'SWEATPANTS'
  | 'JOGGERS'
  | 'CARGO_PANTS'
  | 'OTHER_BOTTOM';
export type ColorName =
  | 'BLACK'
  | 'WHITE'
  | 'GRAY'
  | 'NAVY'
  | 'BLUE'
  | 'RED'
  | 'GREEN'
  | 'YELLOW'
  | 'ORANGE'
  | 'PURPLE'
  | 'PINK'
  | 'BROWN'
  | 'BEIGE'
  | 'CREAM'
  | 'OTHER';

export const clothingCategoryEnum = ['TOP', 'BOTTOM'] as const;
export const clothingTypeMap = {
  TOP: [
    'T_SHIRT',
    'LONG_SLEEVE',
    'HOODIE',
    'SWEATSHIRT',
    'SWEATER',
    'POLO',
    'TANK_TOP',
    'OTHER_TOP',
  ],
  BOTTOM: [
    'JEANS',
    'CHINOS',
    'DRESS_PANTS',
    'SHORTS',
    'SWEATPANTS',
    'JOGGERS',
    'CARGO_PANTS',
    'OTHER_BOTTOM',
  ],
} as const;

export const clothingTypeEnum = [
  'T_SHIRT',
  'LONG_SLEEVE',
  'HOODIE',
  'SWEATSHIRT',
  'SWEATER',
  'POLO',
  'TANK_TOP',
  'OTHER_TOP',
  'JEANS',
  'CHINOS',
  'DRESS_PANTS',
  'SHORTS',
  'SWEATPANTS',
  'JOGGERS',
  'CARGO_PANTS',
  'OTHER_BOTTOM',
] as const;
export const colorEnum = [
  'BLACK',
  'WHITE',
  'GRAY',
  'NAVY',
  'BLUE',
  'RED',
  'GREEN',
  'YELLOW',
  'ORANGE',
  'PURPLE',
  'PINK',
  'BROWN',
  'BEIGE',
  'CREAM',
  'OTHER',
] as const;

export function isTypeForCategory(
  category: ClothingCategory,
  type: ClothingType,
) {
  return clothingTypeMap[category].includes(type as never);
}

const clothingFields = {
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.enum(clothingCategoryEnum),
  type: z.enum(clothingTypeEnum),
  color: z.enum(colorEnum),
  brand: z.string().trim().max(80).optional().or(z.literal('')),
  size: z.string().trim().max(40).optional().or(z.literal('')),
  imageUrl: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        /^\/uploads\/[A-Za-z0-9-]+\.png$/.test(value) ||
        (z.string().url().safeParse(value).success &&
          /^https?:\/\//i.test(value)),
      'Image URL must be a valid URL or local processed image path',
    )
    .optional(),
  description: z.string().trim().max(800).optional().or(z.literal('')),
};

const categoryTypeValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((value, context) => {
    const data = value as { category?: ClothingCategory; type?: ClothingType };
    if (
      data.category &&
      data.type &&
      !isTypeForCategory(data.category, data.type)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: 'Type does not match category.',
      });
    }
  });

export const createClothingSchema = categoryTypeValidation(
  z.object(clothingFields).strict(),
);

export const updateClothingSchema = categoryTypeValidation(
  z
    .object(clothingFields)
    .partial()
    .strict()
    .refine(
      (data) => Object.keys(data).length > 0,
      'Provide at least one field to update.',
    ),
);

export const clothingQuerySchema = z.object({
  category: z.enum(clothingCategoryEnum).optional(),
  type: z.enum(clothingTypeEnum).optional(),
  color: z.enum(colorEnum).optional(),
  brand: z.string().trim().max(80).optional(),
  size: z.string().trim().max(40).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(['newest', 'oldest', 'name-asc', 'name-desc']).optional(),
});
