import { request } from './apiClient';

export interface ProcessedImageResponse {
  imageUrl: string;
}

export function removeBackground(file: File): Promise<ProcessedImageResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return request<ProcessedImageResponse>('/images/remove-background', {
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
