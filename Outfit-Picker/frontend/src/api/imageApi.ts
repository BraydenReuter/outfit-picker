import { request } from './apiClient';

export interface ProcessedImageResponse {
  imageUrl: string;
}

/** Stores a photo whose background was already removed in the browser. */
export function uploadProcessedImage(
  image: Blob,
): Promise<ProcessedImageResponse> {
  const formData = new FormData();
  formData.append('file', image, 'clothing.png');
  return request<ProcessedImageResponse>('/images', {
    method: 'POST',
    body: formData,
  });
}

export function discardProcessedImage(imageUrl: string) {
  return request<null>(
    `/images/${encodeURIComponent(imageUrl.split('/').pop()!)}`,
    { method: 'DELETE' },
  );
}
