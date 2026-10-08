import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Indian financial notation: Cr (crore = 1e7), L (lakh = 1e5), K (thousand)
export function formatCompactCurrency(value: number): string {
  if (value >= 1e7) return `${Number((value / 1e7).toFixed(2))} Cr`;
  if (value >= 1e5) return `${Number((value / 1e5).toFixed(2))} L`;
  if (value >= 1e3) return `${Number((value / 1e3).toFixed(2))}K`;
  return String(Math.round(value));
}

function getApiOrigin(): string {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
}

function normalizeUploadPathname(pathname: string): string {
  if (pathname.startsWith('/api/v1/uploads/')) return pathname;
  if (pathname.startsWith('/uploads/')) return `/api/v1${pathname}`;
  return pathname;
}

function isUploadPathname(pathname: string): boolean {
  return pathname.startsWith('/api/v1/uploads/') || pathname.startsWith('/uploads/');
}

export function getImageUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }

  if (path.startsWith('http')) {
    try {
      const parsed = new URL(path);
      if (!isUploadPathname(parsed.pathname)) {
        return path;
      }
      const apiOrigin = getApiOrigin();
      if (!apiOrigin) return path;

      // If the image URL points to a remote cloud environment (e.g. qaapi.mutinyx.in or production railway app)
      // and our local API is running on localhost, do not rewrite the URL to localhost. This allows the frontend
      // to retrieve existing uploads directly from the cloud environment which matches the database records.
      const isParsedOriginLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.startsWith('192.168.');
      const isApiOriginLocal = apiOrigin.includes('localhost') || apiOrigin.includes('127.0.0.1');

      if (!isParsedOriginLocal && isApiOriginLocal) {
        return path;
      }

      const normalizedPathname = normalizeUploadPathname(parsed.pathname);
      return `${apiOrigin}${normalizedPathname}${parsed.search}`;
    } catch {
      return path;
    }
  }

  // Resolve relative backend paths to absolute URLs for the browser
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  if (!path.startsWith('/')) {
    const keyPath = path.startsWith('uploads/') ? path.slice('uploads/'.length) : path;
    return `${apiBaseUrl.replace(/\/$/, '')}/uploads/${keyPath}`;
  }
  try {
    const url = new URL(apiBaseUrl);
    const normalizedPathname = normalizeUploadPathname(path);
    return `${url.origin}${normalizedPathname}`;
  } catch (e) {
    // Fallback if VITE_API_BASE_URL is relative itself
    return normalizeUploadPathname(path);
  }
}
export function getProxyUrl(url: string): string {
  if (!url || !url.startsWith('http')) return url;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const proxyPath = '/uploads/proxy';
  
  // Resolve base URL
  let base = apiBaseUrl.replace(/\/$/, '');
  if (!base.startsWith('http')) {
    if (typeof window !== 'undefined') {
      base = `${window.location.origin}${base}`;
    }
  }
  
  return `${base}${proxyPath}?url=${encodeURIComponent(url)}`;
}
