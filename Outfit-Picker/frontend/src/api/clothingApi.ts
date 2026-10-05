import type {
  ClothingCategory,
  ClothingItem,
  ClothingType,
  ColorName,
} from '../types';
import { request } from './apiClient';

export interface ClothingFilters {
  category?: ClothingCategory;
  type?: ClothingType;
  color?: ColorName;
  brand?: string;
  size?: string;
  search?: string;
  sort?: 'newest' | 'oldest' | 'name-asc' | 'name-desc';
}

export type CreateClothingPayload = Omit<
  ClothingItem,
  'id' | 'createdAt' | 'updatedAt'
>;
export type UpdateClothingPayload = Partial<CreateClothingPayload>;

export async function fetchClothingItems(
  filters: ClothingFilters = {},
  signal?: AbortSignal,
): Promise<ClothingItem[]> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') params.set(key, value);
  });

  return request<ClothingItem[]>(`/clothing?${params.toString()}`, { signal });
}

export async function fetchClothingItem(id: string): Promise<ClothingItem> {
  return request<ClothingItem>(`/clothing/${id}`);
}

export async function createClothingItem(payload: CreateClothingPayload) {
  return request<ClothingItem>('/clothing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateClothingItem(
  id: string,
  payload: UpdateClothingPayload,
) {
  return request<ClothingItem>(`/clothing/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteClothingItem(id: string) {
  await request<null>(`/clothing/${id}`, {
    method: 'DELETE',
  });
}
