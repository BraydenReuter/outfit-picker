const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export function resolveAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/uploads/'))
    return `${API_BASE_URL.replace(/\/api\/?$/, '')}${path}`;
  return path;
}

type ErrorResponse = {
  message?: string;
  error?: string;
  errors?: { fieldErrors?: Record<string, string[]> };
};

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    if (options?.signal?.aborted)
      throw new DOMException('Request cancelled', 'AbortError');
    throw new Error('Unable to connect to your wardrobe. Please try again.');
  }

  const data = (await response.json().catch(() => null)) as
    | T
    | ErrorResponse
    | null;
  if (!response.ok) {
    const error = data as ErrorResponse | null;
    const details = Object.values(error?.errors?.fieldErrors ?? {})
      .flat()
      .join(' ');
    if (details) throw new Error(details);
    throw new Error(
      error?.message ?? error?.error ?? `Request failed (${response.status}).`,
    );
  }

  return data as T;
}
