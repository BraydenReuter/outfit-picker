import { useState } from 'react';
import { resolveAssetUrl } from '../api/apiClient';

export function ClothingImage({
  imageUrl,
  name,
  className = '',
}: {
  imageUrl?: string | null;
  name: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return imageUrl && failedUrl !== imageUrl ? (
    <img
      className={className}
      src={resolveAssetUrl(imageUrl)}
      alt={name}
      loading="lazy"
      onError={() => setFailedUrl(imageUrl)}
    />
  ) : (
    <div
      className={`image-placeholder ${className}`}
      role="img"
      aria-label={`${name}: no photo`}
    >
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <path d="m27 16-17 12 9 16 10-5v27h22V39l10 5 9-16-17-12c-4 8-22 8-26 0Z" />
      </svg>
      <span>{imageUrl ? 'Photo unavailable' : 'No photo yet'}</span>
    </div>
  );
}
