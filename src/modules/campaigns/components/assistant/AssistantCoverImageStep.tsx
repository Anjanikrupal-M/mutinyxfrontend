import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, ArrowRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUploadThumbnail } from '@/modules/campaigns/hooks/useCampaigns';

/**
 * The last thing the assistant needs and the one thing it cannot produce: a cover image.
 *
 * It is asked for HERE, in the conversation, rather than by dropping the user into the builder
 * to hunt for the upload control. Previously confirming a draft navigated straight to
 * /campaigns/:id/edit with no step, which landed them on step 1 of the wizard — re-entering a
 * campaign they had just finished describing. Now they attach the image in the chat and go
 * directly to the preview, with nothing left to fill in.
 *
 * Upload only becomes possible once the campaign row exists (POST /campaigns/:id/thumbnail
 * needs an id), which is why this renders after Confirm rather than on the proposal card.
 */

// Mirrors the builder's own cover-image rules — a file this component accepts must not be
// rejected by the page the user lands on next.
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png']);

export function AssistantCoverImageStep({
    campaignId,
    campaignName,
    onDone,
}: {
    campaignId: string;
    campaignName?: string;
    onDone: (uploaded: boolean) => void;
}) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const uploadThumbnail = useUploadThumbnail();

    // createObjectURL holds the file in memory until it is revoked; without this every image
    // the user swaps through leaks for the lifetime of the conversation.
    useEffect(() => {
        if (!file) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const pick = (picked: File | undefined | null) => {
        if (!picked) return;
        if (!ALLOWED_TYPES.has(picked.type)) {
            setError('Only JPG and PNG images are allowed.');
            return;
        }
        if (picked.size > MAX_BYTES) {
            setError('Cover image must be 5MB or smaller.');
            return;
        }
        setError(null);
        setFile(picked);
    };

    const attach = async () => {
        if (!file) return;
        try {
            await uploadThumbnail.mutateAsync({ id: campaignId, file });
            onDone(true);
        } catch {
            // Kept on screen rather than navigating away: the campaign exists either way, and
            // silently moving on would leave them at a preview with no cover and no idea why.
            setError('That upload did not go through. Try again, or skip and add it in the builder.');
        }
    };

    const busy = uploadThumbnail.isPending;

    return (
        <div className="rounded-xl border-2 border-primary/60 bg-card p-4 animate-fade-in">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#fedc03] text-black flex items-center justify-center shrink-0">
                    <ImagePlus className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">One last thing — a cover image</p>
                    <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">
                        {campaignName ? `"${campaignName}" is saved as a draft. ` : 'Your draft is saved. '}
                        Add a cover and I will take you straight to the preview.
                    </p>
                </div>
            </div>

            {previewUrl ? (
                <div className="mt-3 relative rounded-lg overflow-hidden border border-border">
                    <img src={previewUrl} alt="Cover preview" className="w-full h-40 object-cover" />
                    <button
                        type="button"
                        onClick={() => setFile(null)}
                        disabled={busy}
                        aria-label="Remove image"
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-background transition-premium disabled:opacity-50"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                    className={cn(
                        'mt-3 w-full rounded-lg border-2 border-dashed py-6 flex flex-col items-center gap-1.5 transition-premium',
                        error ? 'border-red-500' : 'border-border hover:border-primary/50 hover:bg-secondary',
                    )}
                >
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[13px] font-medium">Choose a cover image</span>
                    <span className="text-[11px] text-muted-foreground">JPG or PNG, up to 5MB</span>
                </button>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                    pick(e.target.files?.[0]);
                    // Cleared so re-picking the same file after a validation error still fires.
                    e.target.value = '';
                }}
            />

            {error ? <p className="text-[12px] text-red-500 mt-2">{error}</p> : null}

            <div className="flex flex-wrap gap-2 mt-3">
                <button
                    type="button"
                    onClick={attach}
                    disabled={!file || busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-premium disabled:opacity-40"
                >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {busy ? 'Uploading…' : 'Attach & open preview'}
                </button>
                <button
                    type="button"
                    onClick={() => onDone(false)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-premium disabled:opacity-50"
                >
                    Skip for now
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
