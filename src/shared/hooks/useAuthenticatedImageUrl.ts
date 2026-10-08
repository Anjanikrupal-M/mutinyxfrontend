import { useEffect, useState } from 'react';
import http from '@/core/http';
import { getImageUrl, getProxyUrl } from '@/lib/utils';

function isBlockedCdnUrl(url: string) {
  return (
    url.includes('cdninstagram.com') ||
    url.includes('fbcdn.net') ||
    url.includes('yt3.ggpht.com') ||
    url.includes('ytimg.com') ||
    url.includes('googleusercontent.com')
  );
}

/**
 * Meta's CDNs, specifically. Their image URLs are signed and short-lived (`oh=` signature,
 * `oe=` expiry) and additionally Referer-checked, so once the proxy cannot fetch one the
 * browser certainly cannot either — a direct <img src> retry is guaranteed to fail with
 * 403 or ERR_NAME_NOT_RESOLVED (the hostnames are region-sharded and not always resolvable).
 * Callers use this to skip that retry and go straight to a placeholder instead of filling
 * the console with errors for an image that cannot load by any route.
 *
 * Deliberately narrower than isBlockedCdnUrl: Google/YouTube CDN URLs are not signed and do
 * often load directly, so those keep the retry.
 */
export function isUnfetchableCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('cdninstagram.com') || url.includes('fbcdn.net');
}

/**
 * Resolves API base origin the same way as getImageUrl (handles relative VITE_API_BASE_URL).
 */
function getApiOrigin(): string | null {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    if (typeof window !== 'undefined') return window.location.origin;
    return null;
  }
}

/**
 * Paths that need axios (Bearer + cookies) because plain <img> cannot send Authorization.
 *
 * NOTE: /uploads/* on the backend is intentionally public (no authenticate middleware on
 * its router), so we skip the auth-fetch path for it. Letting the browser load these
 * images natively means we get free lazy-loading (loading="lazy") and parallel-fetch
 * limits — the previous behaviour fired one http.get per image on mount, which made
 * chats with many images stutter on open.
 */
function isUploadPath(path: string): boolean {
  if (!path.startsWith('/') && !path.startsWith('http')) {
    // Raw storage key like "messages/abc.jpg"
    return true;
  }
  if (path.startsWith('/uploads/') || path.startsWith('/api/v1/uploads/')) {
    return true;
  }
  if (path.startsWith('http')) {
    try {
      const u = new URL(path);
      return u.pathname.startsWith('/uploads/') || u.pathname.startsWith('/api/v1/uploads/');
    } catch {
      return false;
    }
  }
  return false;
}

export function shouldFetchImageWithAuth(path: string): boolean {
  if (!path || path.startsWith('data:') || path.startsWith('blob:')) return false;
  // Public uploads — let the browser fetch directly (enables native lazy-loading).
  if (isUploadPath(path)) return false;
  if (path.startsWith('/api/v1/')) return true;
  const origin = getApiOrigin();
  if (!origin) return false;
  try {
    const u = new URL(path);
    return u.origin === origin;
  } catch {
    return false;
  }
}

/** Path segment for axios baseURL `/api/v1` + this = full upload URL */
export function toApiV1RelativePath(path: string): string {
  const pathname = path.startsWith('http') ? new URL(path).pathname : path;
  if (!pathname.startsWith('/') && !pathname.startsWith('http')) {
    const keyPath = pathname.startsWith('uploads/') ? pathname.slice('uploads/'.length) : pathname;
    return `/uploads/${keyPath}`;
  }
  const prefix = '/api/v1';
  if (pathname.startsWith(prefix)) {
    const rest = pathname.slice(prefix.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export interface UseAuthenticatedImageUrlResult {
  /** Ready-to-use src for <img> (blob URL, absolute URL, or data URL) */
  url: string | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Loads images from the API with the same auth as JSON requests.
 * Use for /api/v1/uploads/... and other protected static assets.
 */
export function useAuthenticatedImageUrl(path?: string | null): UseAuthenticatedImageUrlResult {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(undefined);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (path.startsWith('data:') || path.startsWith('blob:')) {
      setUrl(path);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!shouldFetchImageWithAuth(path)) {
      if (isBlockedCdnUrl(path)) {
        setUrl(getProxyUrl(path));
      } else {
        setUrl(getImageUrl(path));
      }
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    setIsLoading(true);
    setError(null);

    const relativePath = toApiV1RelativePath(path);

    http
      .get(relativePath, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
        setUrl(undefined);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return { url, isLoading, error };
}
