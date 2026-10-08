import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Download, X, Loader2, FileText, Video as VideoIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthenticatedImageUrl } from '@/shared/hooks/useAuthenticatedImageUrl';
import { toast } from 'sonner';

export type AttachmentKind = 'image' | 'pdf' | 'video';

interface MessageAttachmentViewerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    src: string;
    kind: AttachmentKind;
    fileName: string;
}

export function MessageAttachmentViewer({
    open,
    onOpenChange,
    src,
    kind,
    fileName,
}: MessageAttachmentViewerProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const { url, isLoading, error } = useAuthenticatedImageUrl(open ? src : null);

    const handleDownload = async () => {
        if (!url) return;
        setIsDownloading(true);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = fileName || 'attachment';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
        } catch {
            toast.error('Could not download file');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className={cn(
                        'fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                    )}
                />
                <DialogPrimitive.Content
                    className={cn(
                        'fixed inset-0 z-[210] flex flex-col outline-none',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                    )}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <DialogPrimitive.Title className="sr-only">{fileName}</DialogPrimitive.Title>

                    <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-black/50">
                        <p className="text-sm text-white/80 truncate flex items-center gap-2 min-w-0">
                            {kind === 'pdf' && <FileText className="w-4 h-4 shrink-0" />}
                            {kind === 'video' && <VideoIcon className="w-4 h-4 shrink-0" />}
                            <span className="truncate">{fileName}</span>
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                            {/* Videos are review-only — no download button (see SubmissionMediaViewer). */}
                            {kind !== 'video' && (
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    disabled={!url || isDownloading}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 transition-premium disabled:opacity-50"
                                    aria-label="Download"
                                >
                                    {isDownloading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Download className="w-3.5 h-3.5" />
                                    )}
                                    <span className="hidden sm:inline">Download</span>
                                </button>
                            )}
                            <DialogPrimitive.Close
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white bg-white/10 hover:bg-white/20 transition-premium"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </DialogPrimitive.Close>
                        </div>
                    </div>

                    <div
                        className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-4"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) onOpenChange(false);
                        }}
                    >
                        {isLoading ? (
                            <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
                        ) : error || !url ? (
                            <p className="text-sm text-white/60">Could not load file</p>
                        ) : kind === 'image' ? (
                            <img
                                src={url}
                                alt={fileName}
                                className="max-w-full max-h-full object-contain rounded-lg select-none"
                                draggable={false}
                            />
                        ) : kind === 'video' ? (
                            <video
                                src={url}
                                controls
                                autoPlay
                                playsInline
                                controlsList="nodownload noremoteplayback noplaybackrate"
                                disablePictureInPicture
                                onContextMenu={(e) => e.preventDefault()}
                                className="max-w-full max-h-full rounded-lg outline-none"
                            />
                        ) : (
                            <iframe
                                src={url}
                                title={fileName}
                                className="w-full h-full bg-white rounded-lg"
                            />
                        )}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
