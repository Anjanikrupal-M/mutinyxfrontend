import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Largest size the picked image is shown at inside the dialog.
const MAX_W = 400;
const MAX_H = 310;
const MIN_SIDE = 48;
const OUTPUT_W = 1080;

const SHAPES = [
    { id: 'app', label: '3:4 · App card', ratio: 3 / 4 },
    { id: 'square', label: '1:1 · Square', ratio: 1 },
    { id: 'free', label: 'Free', ratio: null },
] as const;
type ShapeId = (typeof SHAPES)[number]['id'];

type Size = { w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number };
type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// Corners are thick L-shaped brackets hugging the box, edges short bars (like a phone's photo
// editor). `mark` is the visible shape; the grab area around it is much larger.
const bracket = 'absolute h-5 w-5 border-white group-hover:border-brand group-active:border-brand';
const bar = 'rounded-full bg-white group-hover:bg-brand group-active:bg-brand';
const HANDLES: { id: Exclude<Handle, 'move'>; position: string; cursor: string; mark: string }[] = [
    { id: 'nw', position: 'left-0 top-0', cursor: 'cursor-nwse-resize', mark: `${bracket} left-1/2 top-1/2 -ml-[3px] -mt-[3px] rounded-tl-md border-l-4 border-t-4` },
    { id: 'n', position: 'left-1/2 top-0', cursor: 'cursor-ns-resize', mark: `${bar} h-1 w-9` },
    { id: 'ne', position: 'left-full top-0', cursor: 'cursor-nesw-resize', mark: `${bracket} right-1/2 top-1/2 -mr-[3px] -mt-[3px] rounded-tr-md border-r-4 border-t-4` },
    { id: 'e', position: 'left-full top-1/2', cursor: 'cursor-ew-resize', mark: `${bar} h-9 w-1` },
    { id: 'se', position: 'left-full top-full', cursor: 'cursor-nwse-resize', mark: `${bracket} bottom-1/2 right-1/2 -mb-[3px] -mr-[3px] rounded-br-md border-b-4 border-r-4` },
    { id: 's', position: 'left-1/2 top-full', cursor: 'cursor-ns-resize', mark: `${bar} h-1 w-9` },
    { id: 'sw', position: 'left-0 top-full', cursor: 'cursor-nesw-resize', mark: `${bracket} bottom-1/2 left-1/2 -mb-[3px] -ml-[3px] rounded-bl-md border-b-4 border-l-4` },
    { id: 'w', position: 'left-0 top-1/2', cursor: 'cursor-ew-resize', mark: `${bar} h-9 w-1` },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// The starting box sits slightly inside the image, so the dimmed border shows what will be cut
// and every handle is clear of the image edge.
const START_INSET = 0.9;

/** Centred starting rectangle of the given shape, a little smaller than the biggest that fits. */
function largestRect(bounds: Size, ratio: number | null): Rect {
    const fullW = !ratio ? bounds.w : bounds.w / bounds.h > ratio ? bounds.h * ratio : bounds.w;
    const fullH = ratio ? fullW / ratio : bounds.h;
    const w = fullW * START_INSET;
    const h = fullH * START_INSET;
    return { x: (bounds.w - w) / 2, y: (bounds.h - h) / 2, w, h };
}

/** Where the crop box ends up after dragging `handle` by (dx, dy), kept inside the image and on-shape. */
function dragRect(start: Rect, handle: Handle, dx: number, dy: number, bounds: Size, ratio: number | null): Rect {
    if (handle === 'move') {
        return {
            ...start,
            x: clamp(start.x + dx, 0, bounds.w - start.w),
            y: clamp(start.y + dy, 0, bounds.h - start.h),
        };
    }

    let left = start.x;
    let top = start.y;
    let right = start.x + start.w;
    let bottom = start.y + start.h;
    if (handle.includes('w')) left = clamp(left + dx, 0, right - MIN_SIDE);
    if (handle.includes('e')) right = clamp(right + dx, left + MIN_SIDE, bounds.w);
    if (handle.includes('n')) top = clamp(top + dy, 0, bottom - MIN_SIDE);
    if (handle.includes('s')) bottom = clamp(bottom + dy, top + MIN_SIDE, bounds.h);

    if (ratio) {
        let w = right - left;
        let h = bottom - top;
        if (handle.length === 2) {
            // Corner: the width leads, the opposite corner stays put.
            h = w / ratio;
            const room = handle.includes('n') ? bottom : bounds.h - top;
            if (h > room) {
                h = room;
                w = h * ratio;
            }
            if (handle.includes('n')) top = bottom - h;
            else bottom = top + h;
            if (handle.includes('w')) left = right - w;
            else right = left + w;
        } else if (handle === 'e' || handle === 'w') {
            // Side edge: the height follows, growing evenly above and below.
            const cy = start.y + start.h / 2;
            h = w / ratio;
            const room = 2 * Math.min(cy, bounds.h - cy);
            if (h > room) {
                h = room;
                w = h * ratio;
                if (handle === 'w') left = right - w;
                else right = left + w;
            }
            top = cy - h / 2;
            bottom = cy + h / 2;
        } else {
            // Top/bottom edge: the width follows, growing evenly left and right.
            const cx = start.x + start.w / 2;
            w = h * ratio;
            const room = 2 * Math.min(cx, bounds.w - cx);
            if (w > room) {
                w = room;
                h = w / ratio;
                if (handle === 'n') top = bottom - h;
                else bottom = top + h;
            }
            left = cx - w / 2;
            right = cx + w / 2;
        }
    }

    return { x: left, y: top, w: right - left, h: bottom - top };
}

interface CoverCropperProps {
    src: string;
    onCancel: () => void;
    onApply: (cropped: Blob) => void;
}

/**
 * Cover-image crop dialog for the campaign builder. Defaults to the 3:4 app-card shape.
 *
 * Note: the crop box, image size and dimmed overlays use inline `style` — their geometry is
 * computed per pixel while dragging, which Tailwind classes can't express.
 */
export function CoverCropper({ src, onCancel, onApply }: CoverCropperProps) {
    const [natural, setNatural] = useState<Size | null>(null);
    const [shape, setShape] = useState<ShapeId>('app');
    // Crop box in on-screen pixels, relative to the displayed image.
    const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
    const [dragging, setDragging] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const drag = useRef<{ handle: Handle; x: number; y: number; rect: Rect } | null>(null);

    const ratio = SHAPES.find((s) => s.id === shape)!.ratio;
    // On-screen pixels per image pixel.
    const fit = natural ? Math.min(MAX_W / natural.w, MAX_H / natural.h) : 1;
    const shown: Size = natural ? { w: natural.w * fit, h: natural.h * fit } : { w: 0, h: 0 };

    const latestCancel = useRef(onCancel);
    latestCancel.current = onCancel;

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') latestCancel.current();
        };
        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    const pickShape = (id: ShapeId) => {
        setShape(id);
        const nextRatio = SHAPES.find((s) => s.id === id)!.ratio;
        // "Free" keeps the current box; a fixed shape snaps to the largest box of that shape.
        if (nextRatio) setRect(largestRect(shown, nextRatio));
    };

    // Pointer capture keeps the drag alive even when the cursor leaves the handle.
    const dragProps = (handle: Handle) => ({
        onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { handle, x: e.clientX, y: e.clientY, rect };
            setDragging(true);
        },
        onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
            const start = drag.current;
            if (!start) return;
            setRect(dragRect(start.rect, start.handle, e.clientX - start.x, e.clientY - start.y, shown, ratio));
        },
        onPointerUp: () => {
            drag.current = null;
            setDragging(false);
        },
        onPointerCancel: () => {
            drag.current = null;
            setDragging(false);
        },
    });

    const apply = () => {
        const img = imgRef.current;
        if (!img || !natural) return;
        const sourceW = rect.w / fit;
        const sourceH = rect.h / fit;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(Math.min(OUTPUT_W, sourceW));
        canvas.height = Math.round((canvas.width * sourceH) / sourceW);
        canvas.getContext('2d')?.drawImage(img, rect.x / fit, rect.y / fit, sourceW, sourceH, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => blob && onApply(blob), 'image/jpeg', 0.92);
    };

    const dim = 'pointer-events-none absolute bg-black/65';

    // Portalled to <body>: inside the builder an animated ancestor would otherwise become the
    // containing block for `fixed`, pinning the dialog to the page column instead of the screen.
    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cropper-title"
            className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
            onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
        >
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-[500px] animate-fade-up overflow-y-auto rounded-3xl bg-card text-card-foreground shadow-float [animation-duration:250ms]">
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                        <h3 id="cropper-title" className="font-display text-base font-semibold leading-6 tracking-tight">
                            Adjust cover image
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            Drag inside the frame to move it · pull a corner or side to resize · arrow keys nudge
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onCancel}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-secondary"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Always-dark stage so any photo reads against it. */}
                <div className="grid h-[360px] touch-none select-none place-items-center bg-neutral-950">
                    <div className="relative" style={{ width: shown.w, height: shown.h }}>
                        <img
                            ref={imgRef}
                            src={src}
                            alt=""
                            draggable={false}
                            onLoad={(e) => {
                                const size = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
                                const scale = Math.min(MAX_W / size.w, MAX_H / size.h);
                                setNatural(size);
                                setRect(largestRect({ w: size.w * scale, h: size.h * scale }, ratio));
                            }}
                            className={cn('block h-full w-full', !natural && 'invisible')}
                        />

                        {natural && (
                            <>
                                {/* Everything outside the crop box is dimmed. */}
                                <div className={cn(dim, 'inset-x-0 top-0')} style={{ height: rect.y }} />
                                <div className={cn(dim, 'inset-x-0 bottom-0')} style={{ top: rect.y + rect.h }} />
                                <div className={cn(dim, 'left-0')} style={{ top: rect.y, height: rect.h, width: rect.x }} />
                                <div className={cn(dim, 'right-0')} style={{ top: rect.y, height: rect.h, left: rect.x + rect.w }} />

                                <div
                                    {...dragProps('move')}
                                    tabIndex={0}
                                    aria-label="Crop area. Use the arrow keys to move it."
                                    onKeyDown={(e) => {
                                        const stepSize = e.shiftKey ? 10 : 2;
                                        const move: Record<string, [number, number]> = {
                                            ArrowLeft: [-stepSize, 0],
                                            ArrowRight: [stepSize, 0],
                                            ArrowUp: [0, -stepSize],
                                            ArrowDown: [0, stepSize],
                                        };
                                        const delta = move[e.key];
                                        if (!delta) return;
                                        e.preventDefault();
                                        setRect((r) => dragRect(r, 'move', delta[0], delta[1], shown, ratio));
                                    }}
                                    style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                                    className={cn('absolute outline-none ring-1 ring-white/80', dragging ? 'cursor-grabbing' : 'cursor-grab')}
                                >
                                    {/* Thirds guide: only while adjusting, so the photo stays clear otherwise. */}
                                    <div className={cn('pointer-events-none absolute inset-0 transition-opacity duration-200', dragging ? 'opacity-100' : 'opacity-0')}>
                                        <span className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
                                        <span className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
                                        <span className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
                                        <span className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
                                    </div>

                                    {/* Large invisible grab areas with a small visible mark, so handles are easy to catch. */}
                                    {HANDLES.map(({ id, position, cursor, mark }) => (
                                        <span
                                            key={id}
                                            {...dragProps(id)}
                                            className={cn('group absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center', position, cursor)}
                                        >
                                            {/* The dark glow keeps the white marks visible on pale photos. */}
                                            <span className={cn(mark, 'transition-colors duration-150 [filter:drop-shadow(0_0_2px_rgb(0_0_0/0.9))]')} />
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                    <div role="group" aria-label="Crop shape" className="flex flex-wrap gap-1.5">
                        {SHAPES.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={shape === id}
                                onClick={() => pickShape(id)}
                                className={cn(
                                    'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                                    shape === id ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                        {Math.round(rect.w / fit)} × {Math.round(rect.h / fit)} px
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <button
                        type="button"
                        onClick={() => setRect(largestRect(shown, ratio))}
                        className="flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                        <RotateCcw className="h-4 w-4" /> Reset
                    </button>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="h-10 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-foreground"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={apply}
                            disabled={!natural}
                            className="flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-accent-foreground transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
                        >
                            <Check className="h-4 w-4 stroke-[2.5]" /> Apply
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
