import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, convertToPixelCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCropperProps {
    imageSrc: string;
    /** Locks the crop box to this ratio — the user cannot deviate from it. */
    aspectRatio?: number;
    /**
     * Seeds the opening crop box at this ratio but leaves it free to adjust.
     * Use this (not `aspectRatio`) when you want a suggested shape rather than
     * an enforced one. Ignored when `aspectRatio` is set.
     */
    initialAspectRatio?: number;
    onCropComplete: (croppedImage: string) => void;
    onCancel: () => void;
}

function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    aspect: number
): Crop {
    return centerCrop(
        makeAspectCrop(
            { unit: '%', width: 90 },
            aspect,
            mediaWidth,
            mediaHeight
        ),
        mediaWidth,
        mediaHeight
    );
}

async function getCroppedImg(
    image: HTMLImageElement,
    crop: PixelCrop
): Promise<string> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Canvas truncates fractional dimensions; round so the output doesn't drift
    // off the requested aspect by a pixel on tall sources scaled down a lot.
    canvas.width = Math.round(crop.width * scaleX);
    canvas.height = Math.round(crop.height * scaleY);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
    );

    return canvas.toDataURL('image/jpeg', 0.92);
}

export function ImageCropper({
    imageSrc,
    aspectRatio,
    initialAspectRatio,
    onCropComplete,
    onCancel,
}: ImageCropperProps) {
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isSaving, setIsSaving] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // A locked ratio also defines the opening box; otherwise fall back to the
    // suggested one, and only then to a plain 90% square-ish selection.
    const seedAspect = aspectRatio ?? initialAspectRatio;

    const onImageLoad = useCallback(
        (e: React.SyntheticEvent<HTMLImageElement>) => {
            const { width, height } = e.currentTarget;
            const initial = seedAspect
                ? centerAspectCrop(width, height, seedAspect)
                : ({ unit: '%', width: 90, height: 90, x: 5, y: 5 } as Crop);
            setCrop(initial);
            // Seed completedCrop too: ReactCrop only fires onComplete on user
            // interaction, so without this the default centred selection is
            // visible but Apply stays disabled until the user nudges a handle.
            setCompletedCrop(convertToPixelCrop(initial, width, height));
        },
        [seedAspect]
    );

    const handleConfirm = async () => {
        if (!completedCrop || !imgRef.current) return;
        setIsSaving(true);
        try {
            const croppedImage = await getCroppedImg(imgRef.current, completedCrop);
            onCropComplete(croppedImage);
        } catch (err) {
            console.error('Crop failed:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if (!imgRef.current) return;
        const { width, height } = imgRef.current;
        const initial = seedAspect
            ? centerAspectCrop(width, height, seedAspect)
            : ({ unit: '%', width: 90, height: 90, x: 5, y: 5 } as Crop);
        setCrop(initial);
        setCompletedCrop(convertToPixelCrop(initial, width, height));
    };

    // Lock page scroll while the cropper is open
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    // Portal to <body>: ancestors with a transform (e.g. animate-fade-in's retained
    // scale(1)) become the containing block for fixed positioning, which trapped this
    // overlay inside the page card instead of covering the viewport.
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />

            {/* Modal */}
            <div className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
                    <div>
                        <h3 className="text-sm font-bold">Crop Cover Image</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Drag the corners and edges to adjust the crop area</p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Crop Area */}
                <div className="px-5 py-4 flex flex-1 min-h-0 items-center justify-center bg-black/40 overflow-hidden">
                    <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={aspectRatio}
                        keepSelection
                        className="max-h-full [&_.ReactCrop__crop-selection]:!border-[#fedc03] [&_.ReactCrop__crop-selection]:!border-2 [&_.ReactCrop__drag-handle]:!bg-[#fedc03] [&_.ReactCrop__drag-handle]:!border-[#fedc03] [&_.ReactCrop__drag-handle]:!w-3 [&_.ReactCrop__drag-handle]:!h-3 [&_.ReactCrop__rule-of-thirds-hz]:!border-[#fedc03]/30 [&_.ReactCrop__rule-of-thirds-vt]:!border-[#fedc03]/30"
                        ruleOfThirds
                    >
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            alt="Crop source"
                            onLoad={onImageLoad}
                            className="max-h-[min(60dvh,420px)] max-w-full w-auto object-contain"
                        />
                    </ReactCrop>
                </div>

                {/* Actions */}
                <div className="px-5 py-3.5 border-t border-border flex items-center justify-between shrink-0">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-premium"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-premium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isSaving || !completedCrop}
                            className={cn(
                                'flex items-center gap-2 px-5 py-2 rounded-lg bg-[#fedc03] text-black text-sm font-bold hover:opacity-90 transition-premium',
                                (isSaving || !completedCrop) && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            <Check className="w-4 h-4" />
                            {isSaving ? 'Cropping...' : 'Apply Crop'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
