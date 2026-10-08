import React from 'react';
import { cn } from '@/lib/utils';

interface MutinyXLogoProps {
    /**
     * 'full'  — the wordmark in the black pill, exactly as the landing navbar renders it.
     * 'icon'  — the X mark alone, for tight spots like a collapsed sidebar rail.
     * 'badge' — the X mark as a rounded square.
     * 'plain' — the white wordmark with no pill, for surfaces that are already dark
     *           (the app sidebar), where a black pill shows as a mismatched patch.
     */
    variant?: 'full' | 'icon' | 'badge' | 'plain';
    /** Height class for the artwork itself, e.g. 'h-5'. The pill sizes itself off this. */
    className?: string;
    alt?: string;
}

/**
 * The single source for the MutinyX lockup.
 *
 * `/logo.svg` is the white wordmark, so it needs a dark ground to read against. Rather than
 * keeping a second black-ink file and picking per surface, we use the landing navbar's
 * treatment everywhere: the white wordmark on a black pill. That way one file — the same one
 * the landing page loads — works on light and dark surfaces alike.
 *
 * Keep this in step with the navbar lockup in modules/landing/LandingPage.tsx.
 */
export const MutinyXLogo: React.FC<MutinyXLogoProps> = ({
    variant = 'full',
    className,
    alt = 'MutinyX',
}) => {
    if (variant === 'icon') {
        return (
            <img
                src="/favicon.svg"
                alt={alt}
                className={cn('h-8 w-auto object-contain', className)}
            />
        );
    }

    if (variant === 'badge') {
        return (
            <img
                src="/favicon.svg"
                alt={alt}
                className={cn('h-9 w-9 object-contain rounded-xl', className)}
            />
        );
    }

    if (variant === 'plain') {
        return (
            <img
                src="/logo.svg"
                alt={alt}
                className={cn('w-auto object-contain', className ?? 'h-5')}
            />
        );
    }

    return (
        <span className="inline-flex items-center shrink-0 bg-black rounded-full px-4 py-2 shadow-sm border border-white/5">
            <img
                src="/logo.svg"
                alt={alt}
                className={cn('w-auto object-contain', className ?? 'h-5')}
            />
        </span>
    );
};

export default MutinyXLogo;
