import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiImage } from './ApiImage';

/**
 * A post/reel cover that never shows a browser-broken image. ApiImage resolves stored keys
 * and proxy paths; when the image is missing or fails, the "Preview not available"
 * placeholder underneath shows through its transparent fallback.
 */
export function MediaThumb({ src, alt, className, imageClassName }: {
    src?: string | null;
    alt: string;
    className?: string;
    imageClassName?: string;
}) {
    return (
        <div className={cn('relative overflow-hidden bg-secondary', className)}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground" aria-hidden>
                <ImageOff className="h-5 w-5" />
                <span className="text-[10px]">Preview not available</span>
            </div>
            {src && (
                <ApiImage
                    src={src}
                    alt={alt}
                    className={cn('relative h-full w-full object-cover', imageClassName)}
                    placeholderClassName="bg-transparent"
                />
            )}
        </div>
    );
}
