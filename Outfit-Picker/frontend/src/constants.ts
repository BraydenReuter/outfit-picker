import type { ClothingCategory, ClothingType, ColorName } from './types';

export const categoryOptions: Array<{
  value: ClothingCategory | 'ALL';
  label: string;
}> = [
  { value: 'ALL', label: 'All' },
  { value: 'TOP', label: 'Tops' },
  { value: 'BOTTOM', label: 'Bottoms' },
];

export const colorOptions: ColorName[] = [
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
];

export const typeOptions: Record<'TOP' | 'BOTTOM', ClothingType[]> = {
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
};

export const formatType = (value: string) =>
  value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export interface ClothingFormValues {
  name: string;
  category: ClothingCategory;
  type: ClothingType;
  color: ColorName;
  brand: string;
  size: string;
  imageUrl: string;
  description: string;
}
