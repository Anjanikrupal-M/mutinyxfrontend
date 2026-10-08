import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthenticatedImageUrl, isUnfetchableCdnUrl } from '@/shared/hooks/useAuthenticatedImageUrl';

interface ApiImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  /** Shown while loading or on error (e.g. muted background) */
  placeholderClassName?: string;
  fallbackText?: string;
}

/**
 * Renders campaign/brand images that may require Bearer auth.
 * Plain <img src="https://api.../uploads/..."> does not send Authorization; this fetches via http + blob URL.
 *
 * Fallback chain:
 *  1. Resolved URL (blob, proxy, or absolute API URL)
 *  2. Raw src directly (with no-referrer) — helps external CDN URLs that were proxied but the
 *     proxy returned an error. SKIPPED for Meta CDNs (see isUnfetchableCdnUrl): their URLs are
 *     signed, expiring and Referer-checked, so a direct retry cannot succeed and only emits a
 *     console 403 / ERR_NAME_NOT_RESOLVED per broken avatar before landing on the placeholder
 *  3. Remote production API URL — helps localhost dev where DB has prod image paths not on disk
 *  4. Letter/placeholder fallback
 */
export function ApiImage({ src, alt, className, placeholderClassName, fallbackText }: ApiImageProps) {
  const { url, isLoading, error } = useAuthenticatedImageUrl(src);
  // 0 = use resolved `url`, 1 = try raw src directly, 2 = try remote prod API, 3 = give up
  const [fallbackStage, setFallbackStage] = useState(0);

  // Reset fallback stage whenever the source changes
  useEffect(() => {
    setFallbackStage(0);
  }, [src]);

  const renderFallback = () => {
    if (fallbackText) {
      return (
        <div className={cn('bg-secondary flex items-center justify-center font-bold text-muted-foreground', className, placeholderClassName)}>
          {fallbackText}
        </div>
      );
    }
    return (
      <div
        className={cn('bg-muted', className, placeholderClassName)}
        role="img"
        aria-label={alt}
      />
    );
  };

  if (!src) {
    return fallbackText ? renderFallback() : null;
  }

  if (isLoading) {
    return (
      <div
        className={cn('bg-muted animate-pulse', className, placeholderClassName)}
        aria-hidden
      />
    );
  }

  // If the hook itself errored AND we haven't tried direct src yet, attempt it
  if (error || !url) {
    if (fallbackStage < 3 && src.startsWith('http') && !isUnfetchableCdnUrl(src)) {
      // We'll render the img with src directly and rely on onError to advance stages
      const directUrl = src;
      return (
        <img
          src={directUrl}
          alt={alt}
          className={className}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setFallbackStage(3)}
        />
      );
    }
    return renderFallback();
  }

  // Compute what URL to display based on current fallback stage
  let displayUrl: string = url;
  if (fallbackStage === 1 && src) {
    // Try the raw src directly (good for CDN URLs that proxy might fail on)
    displayUrl = src;
  } else if (fallbackStage === 2 && src) {
    // Try the production API for localhost dev environments.
    // If it's an external HTTP URL, don't just return src again — that causes React
    // to leave the <img> intact without firing onError a second time. We'll append a dummy
    // param or skip to stage 3 to prevent getting stuck.
    if (src.startsWith('http')) {
      return renderFallback();
    } else {
      const keyPath = src.startsWith('uploads/') ? src.slice('uploads/'.length) : src;
      const cleanKeyPath = keyPath.startsWith('/') ? keyPath.slice(1) : keyPath;
      displayUrl = `https://api.mutinyx.in/api/v1/uploads/${cleanKeyPath}`;
    }
  } else if (fallbackStage >= 3) {
    return renderFallback();
  }

  const handleImageError = () => {
    // A Meta CDN URL that the proxy could not serve is dead for good — the signature has
    // expired or the shard hostname does not resolve. Retrying it from the browser just
    // logs another error, so go straight to the placeholder.
    if (isUnfetchableCdnUrl(src)) {
      setFallbackStage(3);
      return;
    }
    if (fallbackStage === 0) {
      // First failure: was the resolved URL a proxy or localhost? Try raw src
      if (url.includes('/proxy') || url.includes('localhost') || url.includes('127.0.0.1')) {
        setFallbackStage(1);
      } else {
        // Resolved URL is already the real src — go straight to prod API fallback
        setFallbackStage(2);
      }
    } else if (fallbackStage === 1) {
      // Raw src failed; try production API path
      setFallbackStage(2);
    } else {
      // All attempts failed — show letter
      setFallbackStage(3);
    }
  };

  return (
    <img
      src={displayUrl}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={handleImageError}
    />
  );
}
