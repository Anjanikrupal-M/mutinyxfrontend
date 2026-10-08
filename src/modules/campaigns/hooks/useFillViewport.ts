import { useLayoutEffect, useRef } from 'react';

/**
 * Sizes an element to run from where it sits down to the bottom of the viewport, minus
 * `bottomGap`, by writing `--fill-h` on it (use with `h-[var(--fill-h)]`). Measured, not a
 * fixed `calc(100vh - Npx)`, because what sits above it varies — approval banners, wrapping
 * headers — and a hard-coded offset either overflows or leaves an empty band below.
 *
 * Re-measures on window resize and whenever the page above it changes size.
 */
export function useFillViewport<T extends HTMLElement>({ bottomGap = 24, minHeight = 420, enabled = true } = {}) {
    const ref = useRef<T>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || !enabled) return undefined;

        const measure = () => {
            // Document-relative top, so the result doesn't change as the page scrolls.
            const top = el.getBoundingClientRect().top + window.scrollY;
            const height = Math.max(minHeight, window.innerHeight - top - bottomGap);
            el.style.setProperty('--fill-h', `${Math.round(height)}px`);
        };

        measure();
        window.addEventListener('resize', measure);
        // Content above the board (banners, header wrap) changes the body's size; the board's
        // own height depends only on its top, so this settles after one pass.
        const observer = new ResizeObserver(measure);
        observer.observe(document.body);
        return () => {
            window.removeEventListener('resize', measure);
            observer.disconnect();
        };
    }, [bottomGap, minHeight, enabled]);

    return ref;
}
