import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2, Play, Image as ImageIcon, Video, Link as LinkIcon, File, X, ChevronLeft } from 'lucide-react';
import { getImageUrl } from '@/lib/utils';
import http from '@/core/http';

// Fetches a PDF via authenticated axios and renders it from a same-origin blob: URL.
// This bypasses the backend's `Content-Security-Policy: frame-ancestors 'self'` which
// otherwise blocks embedding the PDF directly in an iframe from a different origin.
function PdfBlobFrame({ url, openHref }: { url: string; openHref: string }) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let active = true;
        let createdUrl: string | null = null;
        setBlobUrl(null);
        setHasError(false);

        // baseURL: '' so absolute URLs are not prefixed by VITE_API_BASE_URL.
        http.get<Blob>(url, { responseType: 'blob', baseURL: '' })
            .then((res) => {
                if (!active) return;
                createdUrl = URL.createObjectURL(res.data);
                setBlobUrl(createdUrl);
            })
            .catch(() => {
                if (active) setHasError(true);
            });

        return () => {
            active = false;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [url]);

    if (hasError) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
                <FileText className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm font-semibold">PDF preview unavailable</p>
                <p className="text-xs text-muted-foreground">Couldn't load this PDF in-browser.</p>
                <a
                    href={openHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-premium"
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open PDF
                </a>
            </div>
        );
    }

    if (!blobUrl) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const src = `${blobUrl}#toolbar=1&navpanes=0&view=FitH`;
    return (
        <object data={src} type="application/pdf" className="w-full h-full" aria-label="PDF Document Preview">
            <iframe src={src} className="w-full h-full border-0" title="PDF Document Preview" />
        </object>
    );
}

const DOCUMENT_MIME_TYPES = new Set([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
]);

const DOCUMENT_EXTENSIONS = new Set(['doc', 'docx', 'txt', 'rtf', 'odt']);

const IFRAME_BLOCKED_HOSTS = new Set([
    'instagram.com',
    'www.instagram.com',
    'facebook.com',
    'www.facebook.com',
    'x.com',
    'www.x.com',
    'twitter.com',
    'www.twitter.com',
    'linkedin.com',
    'www.linkedin.com',
]);

interface SubmissionMediaViewerProps {
    submission: {
        url?: string;
        fileUrl?: string;
        externalUrl?: string;
        mediaUrl?: string;
        urls?: string[] | string;
        fileUrls?: string[] | string;
        mediaUrls?: string[] | string;
        attachments?: Array<string | { url?: string; mediaUrl?: string; fileUrl?: string }> | string;
        files?: Array<string | { url?: string; mediaUrl?: string; fileUrl?: string }> | string;
        proofOfWorkUrl?: string;
        textContent?: string;
        type?: 'file' | 'link' | string;
        fileName?: string;
        mediaType?: string;
        [key: string]: unknown;
    };
    additionalMedia?: Array<{
        source?: string;
        url?: string | null;
    }>;
    showEmptyState?: boolean;
}

export function SubmissionMediaViewer({ submission, additionalMedia = [], showEmptyState = true }: SubmissionMediaViewerProps) {
    const [mediaFallback, setMediaFallback] = useState<Record<string, 'image-failed' | 'video-failed'>>({});
    const [linkPreviewFallback, setLinkPreviewFallback] = useState<Record<string, boolean>>({});
    const [expandedCardKey, setExpandedCardKey] = useState<string | null>(null);

    const normalizeHttpUrl = (value?: string) => {
        const trimmed = (value || '').trim();
        if (!trimmed) return null;
        if (!/^https?:\/\//i.test(trimmed)) return null;
        try {
            const parsed = new URL(trimmed);
            if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
            return parsed.toString();
        } catch {
            return null;
        }
    };

    const classifyHttpUrl = (
        value?: string,
    ): { normalized: string | null; reason: 'empty' | 'missing_protocol' | 'malformed' | null } => {
        const trimmed = (value || '').trim();
        if (!trimmed) {
            return { normalized: null, reason: 'empty' as const };
        }

        if (!/^https?:\/\//i.test(trimmed)) {
            return { normalized: null, reason: 'missing_protocol' as const };
        }

        try {
            const parsed = new URL(trimmed);
            if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
                return { normalized: null, reason: 'malformed' as const };
            }
            return { normalized: parsed.toString(), reason: null };
        } catch {
            return { normalized: null, reason: 'malformed' as const };
        }
    };

    const extractHttpUrls = (text?: string) => {
        if (!text) return [] as string[];
        const matches = text.match(/https?:\/\/[^\s)\]}>"']+/gi) || [];
        return matches
            .map((entry) => normalizeHttpUrl(entry) || '')
            .filter(Boolean);
    };

    const splitMultiValueUrls = (value: unknown): string[] => {
        if (!value) return [];

        if (Array.isArray(value)) {
            return value.flatMap((entry) => splitMultiValueUrls(entry));
        }

        if (typeof value === 'object') {
            const obj = value as Record<string, unknown>;
            return [obj.url, obj.mediaUrl, obj.fileUrl].flatMap((entry) => splitMultiValueUrls(entry));
        }

        if (typeof value !== 'string') return [];

        const trimmed = value.trim();
        if (!trimmed) return [];

        // Some clients send a serialized JSON array/object of URLs.
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try {
                const parsed = JSON.parse(trimmed) as unknown;
                return splitMultiValueUrls(parsed);
            } catch {
                // Fall through to delimiter-based parsing.
            }
        }

        const chunks = trimmed
            .split(/[\n\r,;]+/)
            .map((entry) => entry.trim())
            .filter(Boolean);

        if (
            chunks.length > 1 &&
            chunks.every((entry) => /^(https?:\/\/|\/api\/|blob:|data:)/i.test(entry))
        ) {
            return chunks;
        }

        return [trimmed];
    };

    const resolveMediaUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('/api/')) {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
            try {
                const origin = new URL(apiBaseUrl).origin;
                return `${origin}${url}`;
            } catch {
                return url;
            }
        }
        return getImageUrl(url);
    };

    const extFromUrl = (url: string) => {
        if (!url) return '';
        try {
            const parsed = new URL(url, window.location.origin);
            const last = parsed.pathname.split('/').pop() || '';
            const idx = last.lastIndexOf('.');
            return idx >= 0 ? last.slice(idx + 1).toLowerCase() : '';
        } catch {
            const cleaned = url.split('?')[0].split('#')[0];
            const last = cleaned.split('/').pop() || '';
            const idx = last.lastIndexOf('.');
            return idx >= 0 ? last.slice(idx + 1).toLowerCase() : '';
        }
    };

    const isImage = (url: string) => {
        const ext = extFromUrl(url);
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    };
    const isVideo = (url: string) => {
        const ext = extFromUrl(url);
        return ['mp4', 'mov', 'webm', 'ogg', 'm4v', 'mkv'].includes(ext);
    };

    const extFromFileName = (name?: string) => {
        if (!name) return '';
        const last = name.toLowerCase().split('/').pop() || '';
        const idx = last.lastIndexOf('.');
        return idx >= 0 ? last.slice(idx + 1) : '';
    };

    const fileNameExt = extFromFileName(submission.fileName);

    const getHostname = (url: string) => {
        try {
            return new URL(url, window.location.origin).hostname.toLowerCase();
        } catch {
            return '';
        }
    };

    const isIframeLikelyBlockedHost = (url: string) => {
        const hostname = getHostname(url);
        return IFRAME_BLOCKED_HOSTS.has(hostname);
    };

    const isPortraitPreviewUrl = (url: string) => {
        if (!url) return false;
        return /instagram\.com\/(?:p|reel|reels|tv)\//i.test(url)
            || /tiktok\.com\//i.test(url)
            || /youtube\.com\/shorts\//i.test(url)
            || /youtu\.be\/shorts\//i.test(url)
            || /youtube\.com\/watch\?v=/i.test(url)
            || /youtu\.be\//i.test(url);
    };

    const getEmbedUrl = (url: string) => {
        if (!url) return null;

        const ytShortsMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/shorts\/|youtu\.be\/shorts\/)([^?&/]+)/i);
        if (ytShortsMatch) return `https://www.youtube.com/embed/${ytShortsMatch[1]}`;

        const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^?&/]+)/i);
        if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

        const vimeoMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/i);
        if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

        // Accepts /p/, /reel/, /reels/, /tv/ — Instagram's embed endpoint accepts
        // /reel/ singular regardless of the original URL form, so we normalize.
        const igMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/(p|reel|reels|tv)\/([^/?#&]+)/i);
        if (igMatch) {
            const segment = igMatch[1].toLowerCase() === 'reels' ? 'reel' : igMatch[1].toLowerCase();
            return `https://www.instagram.com/${segment}/${igMatch[2]}/embed/`;
        }

        const tiktokMatch = url.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/(?:@[^/]+\/video\/|embed\/v2\/)?(\d+)(?:[/?].*)?/i);
        if (tiktokMatch) return `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`;

        return null;
    };

    const textContentLinks = extractHttpUrls(submission.textContent);

    const multiMediaFieldUrls = [
        ...splitMultiValueUrls(submission.fileUrls),
        ...splitMultiValueUrls(submission.mediaUrls),
        ...splitMultiValueUrls(submission.urls),
        ...splitMultiValueUrls(submission.attachments),
        ...splitMultiValueUrls(submission.files),
    ];

    const rawCandidates = [
        ...splitMultiValueUrls(submission.fileUrl).map((url) => ({ source: 'fileUrl' as const, url })),
        ...splitMultiValueUrls(submission.mediaUrl).map((url) => ({ source: 'mediaUrl' as const, url })),
        ...splitMultiValueUrls(submission.url).map((url) => ({ source: 'url' as const, url })),
        ...splitMultiValueUrls(submission.externalUrl).map((url) => ({ source: 'externalUrl' as const, url })),
        ...textContentLinks.map((url) => ({ source: 'textContentUrl' as const, url })),
        ...multiMediaFieldUrls.map((url) => ({ source: 'mediaUrl' as const, url })),
        ...additionalMedia.map((entry) => ({
            source: (entry.source || 'additional') as 'fileUrl' | 'mediaUrl' | 'url' | 'externalUrl' | 'proofOfWorkUrl' | 'textContentUrl' | 'additional',
            url: entry.url ?? '',
        })),
    ]
        .map((item) => ({ ...item, url: (item.url || '').trim() }))
        .filter((item) => item.url);

    const normalizedCandidates = rawCandidates.map((item) => {
        const isMediaSource = item.source === 'fileUrl' || item.source === 'mediaUrl';

        if (isMediaSource) {
            return {
                ...item,
                rawInputUrl: item.url,
                normalizedUrl: item.url,
                invalidLink: false,
                invalidReason: null as 'empty' | 'missing_protocol' | 'malformed' | null,
            };
        }

        const { normalized, reason } = classifyHttpUrl(item.url);
        return {
            ...item,
            rawInputUrl: item.url,
            normalizedUrl: normalized || item.url,
            invalidLink: !normalized,
            invalidReason: reason,
        };
    });

    // Canonical form strips the query string, hash, protocol, 'www.', and trailing slash.
    // It also normalizes Instagram's /reels/ to /reel/ so all permutations of the same
    // resource link (e.g. from textContent regex extraction vs stored url field) de-duplicate correctly.
    const canonicalUrl = (url: string) => {
        try {
            const p = new URL(url);
            let path = p.pathname.replace(/\/+$/, '').toLowerCase();
            // Normalize Instagram reel/reels
            if (path.startsWith('/reels/')) {
                path = path.replace('/reels/', '/reel/');
            }
            return (p.hostname.replace(/^www\./, '') + path);
        } catch {
            return url.replace(/\/+$/, '').toLowerCase().trim();
        }
    };

    // Collect canonical URLs from non-textContent sources so we can suppress
    // textContentUrl duplicates that are already shown via a dedicated field.
    const seenFromPrimarySource = new Set<string>();
    normalizedCandidates.forEach((item) => {
        if (item.source !== 'textContentUrl' && !item.invalidLink) {
            seenFromPrimarySource.add(canonicalUrl(item.normalizedUrl));
        }
    });

    const seen = new Set<string>();
    const uniqueRawUrls = normalizedCandidates.filter((item) => {
        // Skip textContentUrl if the same URL was already captured from a dedicated field.
        if (item.source === 'textContentUrl' && !item.invalidLink && seenFromPrimarySource.has(canonicalUrl(item.normalizedUrl))) {
            return false;
        }
        const dedupeKey = item.invalidLink ? `invalid:${item.rawInputUrl}` : `valid:${canonicalUrl(item.normalizedUrl)}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
    });


    const cards = uniqueRawUrls.map((item, idx) => {
        const rawUrl = item.normalizedUrl;
        const inputUrl = item.rawInputUrl;
        const resolvedUrl = resolveMediaUrl(rawUrl);
        const embedUrl = getEmbedUrl(rawUrl);
        const isBlobUrl = resolvedUrl.startsWith('blob:');
        const key = `${idx}:${rawUrl}`;
        const mediaType = (submission.mediaType || '').toLowerCase();
        const sourceIsFileField = item.source === 'fileUrl' || item.source === 'mediaUrl';
        const sourceCanUseFileHints = sourceIsFileField || (item.source === 'url' && submission.type === 'file');
        const isLikelyImage =
            (sourceCanUseFileHints && mediaType.startsWith('image/')) ||
            isImage(rawUrl) ||
            isImage(resolvedUrl) ||
            (sourceCanUseFileHints && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileNameExt));
        const isLikelyVideo =
            (sourceCanUseFileHints && mediaType.startsWith('video/')) ||
            isVideo(rawUrl) ||
            isVideo(resolvedUrl) ||
            (sourceCanUseFileHints && ['mp4', 'mov', 'webm', 'ogg', 'm4v', 'mkv'].includes(fileNameExt));

        const looksLikeMedia = sourceIsFileField || submission.type === 'file' || isBlobUrl || isLikelyImage || isLikelyVideo;

        const isLikelyPdf =
            (sourceCanUseFileHints && mediaType === 'application/pdf') ||
            extFromUrl(rawUrl) === 'pdf' ||
            extFromUrl(resolvedUrl) === 'pdf' ||
            (sourceCanUseFileHints && fileNameExt === 'pdf');

        const isLikelyDocument =
            (sourceCanUseFileHints && DOCUMENT_MIME_TYPES.has(mediaType)) ||
            DOCUMENT_EXTENSIONS.has(extFromUrl(rawUrl)) ||
            DOCUMENT_EXTENSIONS.has(extFromUrl(resolvedUrl)) ||
            (sourceCanUseFileHints && DOCUMENT_EXTENSIONS.has(fileNameExt));

        let kind: 'image' | 'video' | 'embed' | 'link' | 'unknown-file' | 'invalid-link' | 'pdf' | 'document' = 'link';
        if (item.invalidLink && !looksLikeMedia) {
            kind = 'invalid-link';
        } else if (isLikelyPdf) {
            kind = 'pdf';
        } else if (isLikelyVideo && mediaFallback[key] !== 'video-failed') {
            kind = 'video';
        } else if ((isLikelyImage || isBlobUrl) && mediaFallback[key] !== 'image-failed') {
            kind = 'image';
        } else if (isLikelyDocument) {
            kind = 'document';
        } else if (embedUrl && !looksLikeMedia) {
            kind = 'embed';
        } else if (looksLikeMedia) {
            kind = 'unknown-file';
        }

        return {
            key,
            rawUrl,
            inputUrl,
            resolvedUrl,
            embedUrl,
            kind,
            source: item.source,
            invalidReason: item.invalidReason,
        };
    });

    if (cards.length === 0) {
        if (!showEmptyState) return null;
        return (
            <div className="relative w-full max-h-[80vh] min-h-[260px] flex items-center justify-center p-8 text-center bg-secondary/20 rounded-xl overflow-hidden border border-border">
                <div>
                    <h4 className="text-sm font-bold mb-1">No content preview available</h4>
                    <p className="text-xs text-muted-foreground">No URL provided</p>
                </div>
            </div>
        );
    }

    const renderCardFull = (card: typeof cards[0]) => {
        const linkHostname = getHostname(card.rawUrl);

        const renderLinkCard = () => (
            <a
                key={card.key}
                href={card.resolvedUrl || card.rawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm hover:border-primary/30 transition-premium shrink-0"
            >
                <div className="rounded-xl border border-border bg-linear-to-br from-background via-secondary/30 to-background p-4 mb-4">
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Website Preview</p>
                    <p className="text-base font-semibold mt-2 truncate">{linkHostname || 'External URL'}</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all line-clamp-2">{card.rawUrl}</p>
                </div>
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Shared Link</p>
                        <p className="text-sm font-semibold mt-1 truncate">{linkHostname || 'External URL'}</p>
                        <p className="text-xs text-muted-foreground mt-1 break-all line-clamp-2">{card.rawUrl}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-primary shrink-0">Open</span>
                </div>
            </a>
        );

        const renderInvalidLinkCard = () => (
            <div key={card.key} className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 md:p-5 shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-destructive">Invalid URL</p>
                <p className="text-sm font-semibold mt-2 text-foreground/90 break-all">{card.inputUrl || card.rawUrl}</p>
                <p className="text-xs text-muted-foreground mt-2">
                    Please upload a valid link starting with http:// or https://
                </p>
            </div>
        );

        const renderGenericWebsitePreview = () => {
            const isPortrait = isPortraitPreviewUrl(card.rawUrl);

            if (isIframeLikelyBlockedHost(card.rawUrl)) {
                return (
                    <div key={card.key} className="space-y-2 shrink-0">
                        {renderLinkCard()}
                        <p className="text-[11px] text-muted-foreground px-1">
                            Preview unavailable for this domain due to browser embedding restrictions. Open in new tab.
                        </p>
                    </div>
                );
            }

            if (linkPreviewFallback[card.key]) {
                return (
                    <div key={card.key} className="space-y-2 shrink-0">
                        {renderLinkCard()}
                        <p className="text-[11px] text-muted-foreground px-1">
                            Preview unavailable in-app. Open in new tab.
                        </p>
                    </div>
                );
            }

            return (
                <div
                    key={card.key}
                    className={isPortrait
                        ? 'relative w-full max-w-[360px] mx-auto flex flex-col bg-secondary/20 rounded-xl overflow-hidden border border-border shrink-0'
                        : 'relative w-full flex flex-col bg-secondary/20 rounded-xl overflow-hidden border border-border shrink-0'}
                >
                    <div className="px-3 py-2 border-b border-border bg-background/90 shrink-0">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Website Preview</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{card.rawUrl}</p>
                    </div>
                    <div className={isPortrait
                        ? 'w-full bg-background'
                        : 'w-full aspect-video max-h-[55vh] bg-background'}
                        style={isPortrait ? { aspectRatio: '9 / 16', maxHeight: '60vh' } : undefined}
                    >
                        <iframe
                            src={card.rawUrl}
                            className="w-full h-full border-0"
                            title="Website Preview"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                            scrolling="no"
                            onError={() => setLinkPreviewFallback((prev) => ({ ...prev, [card.key]: true }))}
                        />
                    </div>
                    <div className="p-3 bg-background/80 backdrop-blur-sm border-t border-border flex items-center justify-between gap-4 shrink-0">
                        <span className="text-[10px] text-muted-foreground truncate flex-1">{linkHostname || card.rawUrl}</span>
                        <a
                            href={card.rawUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-[10px] font-bold hover:opacity-90 transition-premium"
                        >
                            <ExternalLink className="w-3 h-3" />
                            Open in New Tab
                        </a>
                    </div>
                </div>
            );
        };

        if (card.kind === 'pdf') {
            const openHref = card.resolvedUrl || card.rawUrl;
            return (
                <div key={card.key} className="relative w-full rounded-xl overflow-hidden border border-border bg-black/5 flex flex-col shrink-0">
                    <div className="w-full aspect-[1/1.4] min-h-[500px] max-h-[80vh] flex items-center justify-center bg-white">
                        <PdfBlobFrame url={openHref} openHref={openHref} />
                    </div>
                    <a
                        href={openHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-[10px] font-bold hover:opacity-90 transition-premium shadow-lg"
                    >
                        <ExternalLink className="w-3 h-3" />
                        Open PDF
                    </a>
                </div>
            );
        }

        if (card.kind === 'document') {
            const docExt = (extFromUrl(card.rawUrl) || extFromUrl(card.resolvedUrl) || fileNameExt || 'doc').toUpperCase();
            const docName = submission.fileName || `Document.${docExt.toLowerCase()}`;
            return (
                <div key={card.key} className="rounded-2xl border border-border bg-card p-5 shadow-sm shrink-0">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{docExt} Document</p>
                            <p className="text-sm font-semibold mt-1 truncate">{docName}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Document previews are not supported in-browser. Open in a new tab to view.
                            </p>
                        </div>
                        <a
                            href={card.resolvedUrl || card.rawUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-premium"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open
                        </a>
                    </div>
                </div>
            );
        }

        if (card.kind === 'unknown-file') {
            if (mediaFallback[card.key] === 'image-failed') {
                return renderLinkCard();
            }
            return (
                <div key={card.key} className="relative w-full rounded-xl overflow-hidden border border-border bg-secondary/30 flex items-center justify-center shrink-0">
                    <img
                        src={card.resolvedUrl}
                        alt="Submission"
                        className="block max-w-full max-h-[70vh] w-auto h-auto object-contain"
                        onError={() => setMediaFallback((prev) => ({ ...prev, [card.key]: 'image-failed' }))}
                    />
                </div>
            );
        }

        if (card.kind === 'image') {
            if (mediaFallback[card.key] === 'image-failed') {
                return renderLinkCard();
            }

            return (
                <div key={card.key} className="relative w-full rounded-xl overflow-hidden border border-border bg-secondary/30 flex items-center justify-center shrink-0">
                    <img
                        src={card.resolvedUrl}
                        alt="Submission"
                        className="block max-w-full max-h-[70vh] w-auto h-auto object-contain"
                        onError={() => setMediaFallback((prev) => ({ ...prev, [card.key]: 'image-failed' }))}
                    />
                    <a
                        href={card.resolvedUrl || card.rawUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-[10px] font-bold hover:opacity-90 transition-premium"
                    >
                        <ExternalLink className="w-3 h-3" />
                        Open in New Tab
                    </a>
                </div>
            );
        }

        if (card.kind === 'video') {
            if (mediaFallback[card.key] === 'video-failed') {
                return renderLinkCard();
            }
            // Videos uploaded from the mobile app come through our own file/media
            // fields (or are served as blob:/api file URLs). For these we hide every
            // download vector — the native controls' download button, the right-click
            // "Save video as" menu, and the direct-file "Open in New Tab" link — so the
            // creator's raw footage can be reviewed but not saved.
            const isUploadedFile =
                card.source === 'fileUrl' ||
                card.source === 'mediaUrl' ||
                card.resolvedUrl.startsWith('blob:') ||
                card.rawUrl.startsWith('/api/');
            return (
                <div key={card.key} className="relative w-full rounded-xl overflow-hidden border border-border bg-black shrink-0">
                    <div className="w-full aspect-video min-h-[220px] max-h-[60vh] flex items-center justify-center">
                        <video
                            src={card.resolvedUrl}
                            controls
                            playsInline
                            preload="metadata"
                            controlsList={isUploadedFile ? 'nodownload noremoteplayback noplaybackrate' : undefined}
                            disablePictureInPicture={isUploadedFile}
                            onContextMenu={isUploadedFile ? (e) => e.preventDefault() : undefined}
                            className="w-full h-full object-contain"
                            onError={() => setMediaFallback((prev) => ({ ...prev, [card.key]: 'video-failed' }))}
                        />
                    </div>
                    {!isUploadedFile && (
                        <a
                            href={card.resolvedUrl || card.rawUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-[10px] font-bold hover:opacity-90 transition-premium"
                        >
                            <ExternalLink className="w-3 h-3" />
                            Open in New Tab
                        </a>
                    )}
                </div>
            );
        }

        if (card.kind === 'embed' && card.embedUrl) {
            const isPortrait = isPortraitPreviewUrl(card.rawUrl);

            return (
                <div
                    key={card.key}
                    className={isPortrait
                        ? 'relative w-full max-w-[430px] mx-auto max-h-[80vh] min-h-[620px] flex flex-col bg-secondary/20 rounded-xl overflow-hidden border border-border shrink-0'
                        : 'relative w-full max-h-[80vh] min-h-[460px] flex flex-col bg-secondary/20 rounded-xl overflow-hidden border border-border shrink-0'}
                >
                    <iframe
                        src={card.embedUrl}
                        className="w-full flex-1 border-0"
                        title="Submission Content"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        scrolling="no"
                        allowFullScreen
                    />
                    <div className="p-3 bg-background/80 backdrop-blur-sm border-t border-border flex items-center justify-between gap-4 shrink-0">
                        <span className="text-[10px] text-muted-foreground truncate flex-1">{card.rawUrl}</span>
                        <a
                            href={card.rawUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-[10px] font-bold hover:opacity-90 transition-premium"
                        >
                            <ExternalLink className="w-3 h-3" />
                            Open in New Tab
                        </a>
                    </div>
                </div>
            );
        }

        if (card.kind === 'invalid-link') {
            return renderInvalidLinkCard();
        }

        if (card.kind === 'link') {
            return renderGenericWebsitePreview();
        }

        return renderLinkCard();
    };

    const renderCardThumbnail = (card: typeof cards[0]) => {
        const linkHostname = getHostname(card.rawUrl);

        if (card.kind === 'image' || card.kind === 'unknown-file') {
            return (
                <div
                    key={card.key}
                    onClick={() => setExpandedCardKey(card.key)}
                    className="aspect-square relative rounded-xl overflow-hidden cursor-pointer group border border-border hover:border-primary/50 transition-colors"
                >
                    <img
                        src={card.resolvedUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={() => setMediaFallback((prev) => ({ ...prev, [card.key]: 'image-failed' }))}
                    />
                </div>
            );
        }

        if (card.kind === 'video') {
            return (
                <div
                    key={card.key}
                    onClick={() => setExpandedCardKey(card.key)}
                    className="aspect-square relative rounded-xl overflow-hidden cursor-pointer group border border-border hover:border-primary/50 transition-colors bg-black flex items-center justify-center"
                >
                    <video src={card.resolvedUrl} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-300" preload="metadata" />
                    <div className="relative z-10 w-10 h-10 rounded-full bg-background/80 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 text-foreground ml-1" />
                    </div>
                </div>
            );
        }

        if (card.kind === 'embed') {
            return (
                <div
                    key={card.key}
                    onClick={() => setExpandedCardKey(card.key)}
                    className="aspect-square relative rounded-xl overflow-hidden cursor-pointer group border border-border hover:border-primary/50 transition-colors bg-linear-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 flex flex-col items-center justify-center p-4 text-center"
                >
                    <div className="w-12 h-12 rounded-full bg-background/80 shadow-xs flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <LinkIcon className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="text-xs font-semibold px-2 truncate w-full text-foreground/80">{linkHostname || 'Social Post'}</span>
                </div>
            );
        }

        if (card.kind === 'pdf' || card.kind === 'document') {
            return (
                <div
                    key={card.key}
                    onClick={() => setExpandedCardKey(card.key)}
                    className="aspect-square relative rounded-xl overflow-hidden cursor-pointer group border border-border hover:border-primary/50 transition-colors bg-secondary/30 flex flex-col items-center justify-center p-4 text-center"
                >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-xs font-semibold px-2 truncate w-full text-foreground/80">{card.kind === 'pdf' ? 'PDF' : 'Document'}</span>
                </div>
            );
        }

        return (
            <div
                key={card.key}
                onClick={() => setExpandedCardKey(card.key)}
                className="aspect-square relative rounded-xl overflow-hidden cursor-pointer group border border-border hover:border-primary/50 transition-colors bg-card flex flex-col items-center justify-center p-4 text-center shadow-xs"
            >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Link</span>
                <span className="text-xs font-semibold px-1 truncate w-full text-foreground/90">{linkHostname || 'External'}</span>
            </div>
        );
    };

    if (cards.length === 0) {
        if (!showEmptyState) return null;
        return (
            <div className="relative w-full max-h-[80vh] min-h-[260px] flex items-center justify-center p-8 text-center bg-secondary/20 rounded-xl overflow-hidden border border-border shrink-0">
                <div>
                    <h4 className="text-sm font-bold mb-1">No content preview available</h4>
                    <p className="text-xs text-muted-foreground">No URL provided</p>
                </div>
            </div>
        );
    }

    if (cards.length === 1) {
        return (
            <div className="space-y-3 shrink-0">
                {renderCardFull(cards[0])}
            </div>
        );
    }

    if (expandedCardKey) {
        const expandedCard = cards.find((c) => c.key === expandedCardKey);
        if (!expandedCard) {
            setExpandedCardKey(null);
            return null;
        }
        return (
            <div className="space-y-3 shrink-0">
                <button
                    onClick={() => setExpandedCardKey(null)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-secondary/30 hover:bg-secondary/50 rounded-lg w-fit cursor-pointer"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Grid
                </button>
                {renderCardFull(expandedCard)}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            {cards.map((card) => renderCardThumbnail(card))}
        </div>
    );
}

