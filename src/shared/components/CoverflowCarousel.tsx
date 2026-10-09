// ─────────────────────────────────────────────────────────────
// CoverflowCarousel — a row of square covers in 3D: the one in the
// centre faces you, the rest rake away to either side. Drag, flick,
// use the arrow keys or click a side cover to bring it forward; the
// caption underneath follows the cover in the centre.
//
// Presentational only: every slide and handler comes from the caller.
// Text uses the surrounding text colour (with opacity for the quiet
// parts), so it reads on a dark stage as well as on a light card.
//
// Card positions are written straight to the DOM on each frame (inline
// transform / opacity), because they change sixty times a second while
// dragging — the one place this app sets styles outside Tailwind.
// ─────────────────────────────────────────────────────────────

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CoverflowSlide {
    /** Stable identity, e.g. the campaign id. */
    id: string;
    /** Plain image cover. Ignored when `cover` is given. */
    src?: string;
    alt: string;
    /** Custom cover (e.g. an authenticated image with a letter fallback); fills the square. */
    cover?: React.ReactNode;
    title?: string;
    subtitle?: React.ReactNode;
    meta?: { label: string; value: string }[];
}

export interface CoverflowCarouselProps {
    slides: CoverflowSlide[];
    /** Slide in the centre on first render. Defaults to the first. */
    initialIndex?: number;
    /** Called when the cover already in the centre is clicked. */
    onActivate?: (index: number) => void;
    /** Degrees the first neighbour tilts. */
    rotate?: number;
    /** How far the first neighbour recedes, as a fraction of card width. */
    depth?: number;
    /** Viewer distance as a multiple of card width — smaller is a wider lens. */
    perspective?: number;
    /** Exponent on distance. Below 1 the rake eases off as cards travel out. */
    falloff?: number;
    /** Opacity lost per step from the centre. */
    fade?: number;
    /** Any CSS length. Everything else is derived from it, so the rake scales. */
    cardWidth?: string;
    /** Space between cards, as a fraction of card width. */
    gap?: number;
    /** Wrap round at the ends. Needs at least five slides to look right; ignored below that. */
    loop?: boolean;
    /** Milliseconds between automatic steps (covers travel right to left). Off when omitted.
        Pauses while the pointer is over the carousel, while it has focus, and in a hidden tab. */
    autoplay?: number;
    showCaption?: boolean;
    /** 'stacked' lists the facts one per line; 'inline' sets them side by side to save height. */
    captionLayout?: 'stacked' | 'inline';
    showPagination?: boolean;
    showNavigation?: boolean;
    /** Names the carousel for assistive tech. */
    label?: string;
    className?: string;
    /** Extra classes for the strip the covers sit in, e.g. its vertical padding. */
    frameClassName?: string;
    cardClassName?: string;
}

// A tap is a press that moved less than this many pixels; anything more is a drag.
const TAP_SLOP = 6;

export function CoverflowCarousel({
    slides,
    initialIndex = 0,
    onActivate,
    rotate = 44,
    depth = 0.6,
    perspective = 3,
    falloff = 0.56,
    fade = 0.1,
    cardWidth = 'clamp(148px, 22vw, 260px)',
    gap = 0.05,
    loop: loopProp = true,
    autoplay,
    showCaption = false,
    captionLayout = 'stacked',
    showPagination = false,
    showNavigation = false,
    label = 'Cover carousel',
    className,
    frameClassName,
    cardClassName,
}: CoverflowCarouselProps) {
    const count = slides.length;
    // A ring of fewer than five would hide its own neighbours (cards vanish half a turn out).
    const loop = loopProp && count >= 5;
    const start = Math.max(0, Math.min(count - 1, initialIndex));

    const frameRef = React.useRef<HTMLDivElement>(null);
    const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    /** Fractional card index at the centre. The single source of truth. */
    const posRef = React.useRef(start);
    /** Where the current settle is headed. Stepping off `pos` instead would
        swallow a keypress that lands mid-flight, before the round-off moves. */
    const targetRef = React.useRef(start);
    const widthRef = React.useRef(0);
    const rafRef = React.useRef<number | null>(null);
    const dragRef = React.useRef<{
        id: number;
        x: number;
        startX: number;
        startY: number;
        pos: number;
        v: number;
        t: number;
    } | null>(null);

    const [selected, setSelected] = React.useState(start);

    /** Nearest whole card, folded back into 0..count-1. */
    const indexAt = React.useCallback(
        (pos: number) => (count > 0 ? ((Math.round(pos) % count) + count) % count : 0),
        [count],
    );

    // Paint straight to the DOM. Sixty state updates a second would re-render
    // every card for numbers React never needs to see.
    const paint = React.useCallback(() => {
        const width = widthRef.current;
        if (!width) return;
        const pitch = width * (1 + gap);
        const pos = posRef.current;

        cardRefs.current.forEach((card, index) => {
            if (!card) return;

            // Fold the distance into the shorter way round the ring. This is the
            // whole looping mechanism — no cloned nodes, no shuffling the DOM.
            let offset = index - pos;
            if (loop) {
                offset = ((offset % count) + count) % count;
                if (offset > count / 2) offset -= count;
            }

            const distance = Math.abs(offset);
            // Both the tilt and the recession ease off as cards travel out —
            // doubling the distance adds only about half again as much of each.
            // A linear ramp folds the second card shut; this keeps it readable.
            const ramp = Math.pow(distance, falloff);
            // Capped short of edge-on so a far card never turns its back.
            const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);

            card.style.transform =
                `translateX(calc(-50% + ${offset * pitch}px)) ` +
                `translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`;

            // A card is teleported across the ring at exactly half a turn out, so it
            // has to be gone by then or the jump is visible.
            const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
            card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge);
            card.style.zIndex = String(100 - Math.round(distance));
        });
    }, [count, depth, fade, falloff, gap, loop, rotate]);

    const settle = React.useCallback(
        (target: number) => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            targetRef.current = target;
            setSelected(indexAt(target));

            // Reduced motion: arrive at once instead of gliding.
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                posRef.current = target;
                paint();
                rafRef.current = null;
                return;
            }

            const step = () => {
                const remaining = target - posRef.current;
                if (Math.abs(remaining) < 0.0004) {
                    posRef.current = target;
                    paint();
                    rafRef.current = null;
                    return;
                }
                // Exponential ease-out, not a spring. Swap in a spring only
                // if the settle needs overshoot.
                posRef.current += remaining * 0.16;
                paint();
                rafRef.current = requestAnimationFrame(step);
            };
            rafRef.current = requestAnimationFrame(step);
        },
        [indexAt, paint],
    );

    const clamp = React.useCallback(
        (pos: number) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))),
        [count, loop],
    );

    const goTo = React.useCallback(
        (index: number) => {
            // Take the shorter way round rather than unwinding the whole ring.
            const target = loop
                ? index + Math.round((targetRef.current - index) / count) * count
                : index;
            settle(clamp(target));
        },
        [clamp, count, loop, settle],
    );

    const nudge = React.useCallback(
        (by: number) => settle(clamp(Math.round(targetRef.current) + by)),
        [clamp, settle],
    );

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        // Only the primary button drags; let right-click and the like through.
        if (event.button !== 0) return;
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        targetRef.current = posRef.current;
        dragRef.current = {
            id: event.pointerId,
            x: event.clientX,
            startX: event.clientX,
            startY: event.clientY,
            pos: posRef.current,
            v: 0,
            t: performance.now(),
        };
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;

        const pitch = widthRef.current * (1 + gap);
        if (!pitch) return;

        const now = performance.now();
        const previous = posRef.current;
        posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch);
        // Cards per second, for the throw.
        drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000;
        drag.t = now;

        const index = indexAt(posRef.current);
        if (index !== selected) setSelected(index);
        paint();
    };

    const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        dragRef.current = null;

        // A press that barely moved is a tap: on the centre cover it activates it, on any
        // other it brings that cover forward. (The frame holds the pointer capture, so the
        // card under the pointer is looked up by position.)
        const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (event.type === 'pointerup' && moved < TAP_SLOP) {
            const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cover-index]');
            const index = hit && frameRef.current?.contains(hit) ? Number(hit.dataset.coverIndex) : null;
            if (index != null) {
                if (index === indexAt(posRef.current)) onActivate?.(index);
                else goTo(index);
                return;
            }
        }

        // Let a flick carry, but never more than two cards.
        const carried = Math.max(-2, Math.min(2, drag.v * 0.18));
        settle(clamp(Math.round(posRef.current + carried)));
    };

    // Card width drives pitch, depth and perspective, so it is the only thing
    // worth measuring — and only when the box actually changes.
    React.useLayoutEffect(() => {
        const frame = frameRef.current;
        if (!frame) return;

        const measure = () => {
            const card = cardRefs.current[0];
            if (!card) return;
            widthRef.current = card.offsetWidth;
            paint();
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(frame);
        return () => observer.disconnect();
    }, [paint]);

    // The list got shorter (e.g. a campaign closed): pull the centre back inside it.
    React.useEffect(() => {
        if (count > 0 && !loop && targetRef.current > count - 1) settle(count - 1);
    }, [count, loop, settle]);

    React.useEffect(
        () => () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        },
        [],
    );

    // Autoplay: step to the next cover on a timer, so the row drifts right to left. Held while
    // someone is pointing at, dragging or focused on the carousel, and for reduced motion.
    const [held, setHeld] = React.useState(false);
    React.useEffect(() => {
        if (!autoplay || count < 2 || held) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const timer = setInterval(() => {
            if (document.hidden || dragRef.current) return;
            const current = Math.round(targetRef.current);
            // Without a ring there is no "next" after the last cover: go back to the first.
            if (!loop && current >= count - 1) goTo(0);
            else nudge(1);
        }, autoplay);
        return () => clearInterval(timer);
    }, [autoplay, count, goTo, held, loop, nudge]);

    const active = slides[Math.min(selected, count - 1)];

    return (
        <div
            className={cn('w-full', className)}
            style={{ ['--cf-card' as string]: cardWidth }}
            role="region"
            aria-roledescription="carousel"
            aria-label={label}
            onPointerEnter={() => setHeld(true)}
            onPointerLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
        >
            <div className="relative">
                <div
                    ref={frameRef}
                    tabIndex={0}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowLeft') {
                            event.preventDefault();
                            nudge(-1);
                        } else if (event.key === 'ArrowRight') {
                            event.preventDefault();
                            nudge(1);
                        } else if ((event.key === 'Enter' || event.key === ' ') && onActivate) {
                            event.preventDefault();
                            onActivate(indexAt(targetRef.current));
                        }
                    }}
                    // Vertical padding keeps the drop shadows clear of the overflow clip.
                    className={cn('cursor-grab overflow-hidden py-10 outline-none ring-brand focus-visible:ring-2 active:cursor-grabbing', frameClassName)}
                    style={{
                        perspective: `calc(var(--cf-card) * ${perspective})`,
                        // Horizontal drag is ours; the page keeps vertical scrolling.
                        touchAction: 'pan-y',
                    }}
                >
                    <div
                        className="relative select-none"
                        style={{
                            height: 'var(--cf-card)',
                            transformStyle: 'preserve-3d',
                        }}
                    >
                        {slides.map((slide, index) => (
                            <div
                                key={slide.id}
                                ref={(node) => {
                                    cardRefs.current[index] = node;
                                }}
                                data-cover-index={index}
                                role="group"
                                aria-roledescription="slide"
                                aria-label={`${slide.alt}, ${index + 1} of ${count}`}
                                // Images inside never take the pointer, so a native image drag can't hijack ours.
                                className={cn(
                                    'absolute left-1/2 top-0 aspect-square overflow-hidden rounded-2xl bg-muted shadow-xl will-change-transform [&_img]:pointer-events-none',
                                    cardClassName,
                                )}
                                style={{ width: 'var(--cf-card)' }}
                            >
                                {slide.cover ?? (
                                    <img
                                        src={slide.src}
                                        alt={slide.alt}
                                        draggable={false}
                                        className="h-full w-full select-none object-cover"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {showNavigation && (
                    <>
                        <button
                            type="button"
                            aria-label="Previous slide"
                            onClick={() => nudge(-1)}
                            className="absolute left-3 top-1/2 z-[200] -translate-y-1/2 rounded-full bg-background/70 p-2 text-foreground backdrop-blur transition hover:bg-background"
                        >
                            <ChevronLeft className="size-5" />
                        </button>
                        <button
                            type="button"
                            aria-label="Next slide"
                            onClick={() => nudge(1)}
                            className="absolute right-3 top-1/2 z-[200] -translate-y-1/2 rounded-full bg-background/70 p-2 text-foreground backdrop-blur transition hover:bg-background"
                        >
                            <ChevronRight className="size-5" />
                        </button>
                    </>
                )}
            </div>

            {showCaption && active?.title && captionLayout === 'inline' && (
                // Autoplay changes the caption on its own, so it is only announced when it is not running.
                <div key={active.id} className="flex flex-col items-center px-5 duration-300 animate-in fade-in" aria-live={autoplay ? 'off' : 'polite'}>
                    <p className="max-w-full truncate text-base font-semibold tracking-tight">{active.title}</p>
                    {active.subtitle && <p className="mt-0.5 text-xs opacity-60">{active.subtitle}</p>}
                    {/* Hairline in the text colour, so it works on light and dark stages alike. */}
                    {active.meta && active.meta.length > 0 && <span aria-hidden className="mt-3 h-px w-full max-w-md bg-current opacity-10" />}
                    {active.meta && active.meta.length > 0 && (
                        <dl className="mt-3 flex max-w-full flex-wrap items-baseline justify-center gap-x-6 gap-y-1 text-xs">
                            {active.meta.map((row) => (
                                <div key={row.label} className="flex items-baseline gap-1.5">
                                    <dt className="opacity-55">{row.label}</dt>
                                    <dd className="font-medium tabular-nums">{row.value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>
            )}

            {showCaption && active?.title && captionLayout === 'stacked' && (
                <div key={active.id} className="mt-2 flex flex-col items-center px-6 duration-300 animate-in fade-in" aria-live={autoplay ? 'off' : 'polite'}>
                    <p className="max-w-full truncate text-[15px] font-semibold tracking-tight">{active.title}</p>
                    {active.subtitle && <p className="mt-1 text-[13px] opacity-60">{active.subtitle}</p>}
                    {active.meta && active.meta.length > 0 && (
                        <dl className="mt-8 w-full max-w-[230px] text-xs">
                            {active.meta.map((row) => (
                                <div key={row.label} className="flex justify-between gap-4 py-[5px]">
                                    <dt className="opacity-55">{row.label}</dt>
                                    <dd className="truncate font-medium tabular-nums">{row.value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>
            )}

            {showPagination && (
                <div className="mt-6 flex items-center justify-center gap-2">
                    {slides.map((slide, index) => (
                        <button
                            key={slide.id}
                            type="button"
                            aria-label={`Go to slide ${index + 1}`}
                            aria-current={index === selected}
                            onClick={() => goTo(index)}
                            className={cn(
                                'size-2 rounded-full bg-current transition-opacity',
                                index === selected ? 'opacity-100' : 'opacity-30',
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
