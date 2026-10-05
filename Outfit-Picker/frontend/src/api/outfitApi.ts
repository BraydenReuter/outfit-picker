import type { Outfit } from '../types';
import { request } from './apiClient';

export const fetchOutfits = (signal?: AbortSignal) =>
  request<Outfit[]>('/outfits', { signal });

export const createOutfit = (payload: {
  name: string;
  description?: string;
  topClothingItemId: string;
  bottomClothingItemId: string;
}) =>
  request<Outfit>('/outfits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const deleteOutfit = (id: string) =>
  request<null>(`/outfits/${id}`, { method: 'DELETE' });
