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

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  type: ClothingType;
  color: ColorName;
  brand: string | null;
  size: string | null;
  imageUrl: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutfitItem {
  id: string;
  outfitId: string;
  clothingItemId: string;
  role: 'TOP' | 'BOTTOM';
  clothingItem: ClothingItem;
}

export interface Outfit {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OutfitItem[];
}
