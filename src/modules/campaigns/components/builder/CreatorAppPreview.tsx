import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
    BatteryFull,
    Camera,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronUp,
    Copy,
    FileText,
    Handshake,
    IndianRupee,
    Layers,
    Link2,
    LockKeyhole,
    MapPin,
    ShieldCheck,
    Signal,
    Users,
    Wifi,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';

// ── Layout constants — ported 1:1 from the creator app's CampaignDetail screen ──
const STATUS_BAR_H = 44; // stands in for insets.top
const BOTTOM_INSET = 34; // stands in for insets.bottom
const COMPACT_POSTER_W = 96;
const COMPACT_POSTER_H = 128;
const COMPACT_HEADER_SIDE = 22;
const COMPACT_GROUP_GAP = 25;
const CONTENT_PANEL_GAP = 25;
const COLLAPSE_DWELL = 30;
const CONTENT_MARGIN = -24;
const DESCRIPTION_LINE_H = 22;
const SCREEN_W = 390; // iPhone 14/15 logical screen
const SCREEN_H = 844;
const FRAME_W = SCREEN_W + 20; // + 10px bezel each side
const FRAME_H = SCREEN_H + 20;

export interface CreatorAppPreviewProps {
    campaignName: string;
    brandName: string;
    brandLogo: string;
    description: string;
    coverImage: string;
    /** Pre-formatted amount for the ₹ hero pill (digits only, no symbol). */
    rate: string;
    creatorTiers: string[];
    niches: string[];
    location: string;
    scriptType: 'brand' | 'creator' | 'none';
    usageRights: string;
    deliverables: { id: string; label: string; count: number }[];
    /** Set only when the collaborator tag is required; the app shows the banner for 'collab' alone. */
    collabChannel: string | null;
    references: string[];
    isPrivate?: boolean;
    className?: string;
}

/** Reanimated's interpolate with Extrapolate.CLAMP. */
function interp(x: number, [a, b]: [number, number], [c, d]: [number, number]) {
    if (b === a) return d;
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return c + (d - c) * t;
}

function useElementSize<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
        ro.observe(el);
        setSize({ w: el.clientWidth, h: el.clientHeight });
        return () => ro.disconnect();
    }, []);
    return [ref, size] as const;
}

/**
 * The creator-app campaign detail screen (pre-apply state) as an iPhone mockup, rendered beside
 * every builder step. Mirrors the app's layout and its scroll-driven morph: the 3:4 hero poster
 * shrinks into a compact header while the content panel slides up, then the panel scrolls.
 * Purely presentational — every value arrives already formatted, so it can never write back into the form.
 */
export function CreatorAppPreview({
    campaignName,
    brandName,
    brandLogo,
    description,
    coverImage,
    rate,
    creatorTiers,
    niches,
    location,
    scriptType,
    usageRights,
    deliverables,
    collabChannel,
    references,
    isPrivate = false,
    className,
}: CreatorAppPreviewProps) {
    const [boxRef, box] = useElementSize<HTMLDivElement>();
    const [scrollerRef, screen] = useElementSize<HTMLDivElement>();
    // The phone is laid out at true iPhone size and scaled to fit, so proportions match the app.
    const scale = box.w && box.h ? Math.min(box.w / FRAME_W, box.h / FRAME_H) : 0;
    const [metaRef, meta] = useElementSize<HTMLDivElement>();
    const [contentRef, content] = useElementSize<HTMLDivElement>();
    const [totalScroll, setTotalScroll] = useState(0);
    const snapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastScroll = useRef(0);

    // Geometry — same formulas as the app.
    const W = screen.w || SCREEN_W;
    const H = screen.h || SCREEN_H;
    const heroW = Math.min(W * 0.46, 260);
    const heroH = heroW * (4 / 3);
    const compactMetaW = Math.min(220, W - COMPACT_POSTER_W - COMPACT_GROUP_GAP - COMPACT_HEADER_SIDE * 2);
    const compactGroupLeft = (W - (COMPACT_POSTER_W + COMPACT_GROUP_GAP + compactMetaW)) / 2;
    const compactMetaLeft = compactGroupLeft + COMPACT_POSTER_W + COMPACT_GROUP_GAP;
    const heroTop = STATUS_BAR_H + 8 + 42 + 16;
    const compactTop = STATUS_BAR_H + 8 + 42 + 22;
    const expandedPosterLeft = (W - heroW) / 2;
    const heroExpandedBottom = heroTop + heroH + (meta.h || 140) + CONTENT_MARGIN;
    const panelTop = compactTop + COMPACT_POSTER_H + CONTENT_PANEL_GAP;
    const collapseDistance = Math.max(heroExpandedBottom - panelTop, 60);
    const headerZoneEnd = collapseDistance + COLLAPSE_DWELL;
    const contentMaxScroll = Math.max(content.h - (H - panelTop), 0);

    const scrollY = Math.min(totalScroll, collapseDistance);
    const contentScrollY = Math.min(Math.max(totalScroll - headerZoneEnd, 0), contentMaxScroll);
    const range: [number, number] = [0, collapseDistance];
    const isCollapsed = scrollY >= collapseDistance - 1;

    // Settle inside the header zone like the app's spring: fully expanded or fully docked.
    const handleScroll = () => {
        const el = scrollerRef.current;
        if (!el) return;
        const t = el.scrollTop;
        const dir = t - lastScroll.current;
        lastScroll.current = t;
        setTotalScroll(t);
        clearTimeout(snapTimer.current);
        snapTimer.current = setTimeout(() => {
            const now = el.scrollTop;
            if (now <= 0 || now >= headerZoneEnd) return;
            const docked = dir >= 0 ? now > headerZoneEnd * 0.25 : now > headerZoneEnd * 0.75;
            el.scrollTo({ top: docked ? headerZoneEnd : 0, behavior: 'smooth' });
        }, 140);
    };
    useEffect(() => () => clearTimeout(snapTimer.current), []);

    const posterStyle: CSSProperties = {
        top: interp(scrollY, range, [heroTop, compactTop]),
        left: interp(scrollY, range, [expandedPosterLeft, compactGroupLeft]),
        width: interp(scrollY, range, [heroW, COMPACT_POSTER_W]),
        height: interp(scrollY, range, [heroH, COMPACT_POSTER_H]),
        borderRadius: interp(scrollY, range, [24, 10]),
    };
    const expandedMetaStyle: CSSProperties = {
        top: heroTop + heroH,
        opacity: interp(scrollY, [0, collapseDistance * 0.18], [1, 0]),
        transform: `translateY(${interp(scrollY, range, [0, -28])}px) scale(${interp(scrollY, range, [1, 0.9])})`,
    };
    const compactZone: [number, number] = [collapseDistance * 0.65, collapseDistance];
    const compactHeaderStyle: CSSProperties = {
        top: compactTop,
        left: compactMetaLeft,
        width: compactMetaW,
        opacity: interp(scrollY, compactZone, [0, 1]),
        transform: `translateX(${interp(scrollY, compactZone, [24, 0])}px) scale(${interp(scrollY, compactZone, [0.9, 1])})`,
    };

    const title = campaignName.trim();
    const titleNode = title || <span className="text-white/30">Campaign name</span>;
    const brandRow = (centered: boolean) => (
        <div className={cn('flex items-center gap-2', centered && 'mt-1 justify-center')}>
            {brandLogo && <ApiImage src={brandLogo} alt="" className="h-5 w-5 shrink-0 rounded-md bg-white/10 object-cover" />}
            <span className="truncate text-[13px] font-medium text-[#D4D4D8]">{brandName || 'Your brand'}</span>
        </div>
    );

    return (
        <div ref={boxRef} className={cn('relative w-full', className)}>
        <div
            className="absolute top-0 rounded-[3rem] bg-[#1c1c1e] p-[10px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/10"
            style={{ width: FRAME_W, height: FRAME_H, left: (box.w - FRAME_W * scale) / 2, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
            {/* Side buttons */}
            <span aria-hidden className="absolute -left-[3px] top-28 h-8 w-[3px] rounded-l bg-[#2c2c2e]" />
            <span aria-hidden className="absolute -left-[3px] top-40 h-14 w-[3px] rounded-l bg-[#2c2c2e]" />
            <span aria-hidden className="absolute -right-[3px] top-36 h-20 w-[3px] rounded-r bg-[#2c2c2e]" />

            <div className="relative h-full overflow-hidden rounded-[2.4rem] bg-[#0B0B0C] text-white antialiased">
                {/* Blurred backdrop */}
                {coverImage && (
                    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                        <ApiImage src={coverImage} alt="" className="h-full w-full scale-125 object-cover blur-[70px]" />
                        <div className="absolute inset-0 bg-[rgba(11,11,12,0.65)]" />
                    </div>
                )}

                {/* Status bar + Dynamic Island */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex h-11 items-center justify-between px-7 text-[13px] font-semibold">
                    <span className="tabular-nums">9:41</span>
                    <span aria-hidden className="absolute left-1/2 top-2.5 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black ring-1 ring-white/[0.04]" />
                    <span className="flex items-center gap-1">
                        <Signal className="h-3.5 w-3.5" strokeWidth={2.5} />
                        <Wifi className="h-3.5 w-3.5" strokeWidth={2.5} />
                        <BatteryFull className="h-4 w-4" strokeWidth={2} />
                    </span>
                </div>

                {/* Single scroll surface: a sticky stage drives every morph from scrollTop, the spacer supplies the range. */}
                <div
                    ref={scrollerRef}
                    onScroll={handleScroll}
                    className="absolute inset-0 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    <div className="sticky top-0 h-full overflow-hidden">
                        {/* Top bar */}
                        <div className="absolute inset-x-4 z-50 flex items-center justify-between" style={{ top: STATUS_BAR_H + 8 }}>
                            <button
                                type="button"
                                aria-label="Back"
                                onClick={() => isCollapsed && scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                                className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/[0.12]"
                            >
                                <ChevronLeft
                                    className="h-[22px] w-[22px]"
                                    strokeWidth={2.5}
                                    style={{ transform: `rotate(${interp(scrollY, range, [0, -90])}deg)` }}
                                />
                            </button>
                        </div>

                        {/* Morphing poster */}
                        <div className="absolute z-[46] overflow-hidden bg-[#1A1B1E] shadow-[0_8px_16px_rgba(0,0,0,0.35)]" style={posterStyle}>
                            {coverImage ? (
                                <ApiImage src={coverImage} alt="Cover preview" className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full items-center justify-center text-white/20">
                                    <Camera className="h-7 w-7" strokeWidth={1.5} />
                                </div>
                            )}
                        </div>

                        {/* Compact sticky header (fades in as the poster docks) */}
                        <div className="pointer-events-none absolute z-[45] flex flex-col gap-1.5" style={compactHeaderStyle}>
                            <h2 className="line-clamp-2 break-words text-left text-[17px] font-extrabold tracking-[-0.4px] text-[#F5F5F7]">{titleNode}</h2>
                            {brandRow(false)}
                        </div>

                        {/* Expanded header meta: title, brand, stat pills */}
                        <div ref={metaRef} className="pointer-events-none absolute inset-x-0 z-[44]" style={expandedMetaStyle}>
                            <div className="flex flex-col items-center gap-1.5 px-6 pb-6 pt-4">
                                <h2 className="break-words text-center text-[20px] font-extrabold tracking-[-0.4px] text-[#F5F5F7]">{titleNode}</h2>
                                {brandRow(true)}
                                <div className="mt-2 flex gap-2">
                                    <StatPill icon={<Users className="h-3 w-3" strokeWidth={2.5} />} text="0 Applied" />
                                    <StatPill icon={<IndianRupee className="h-3 w-3" strokeWidth={2.5} />} text={`₹${rate || '0'}`} />
                                </div>
                            </div>
                        </div>

                        {/* Sliding content panel */}
                        <div
                            className="absolute inset-x-0 bottom-0 z-10 overflow-hidden rounded-t-[28px] bg-black"
                            style={{ top: interp(scrollY, range, [heroExpandedBottom, panelTop]) }}
                        >
                            <div className="h-full [mask-image:linear-gradient(to_bottom,transparent,#000_28px)]">
                                <div
                                    ref={contentRef}
                                    className="px-5 pt-6"
                                    style={{ paddingBottom: 132 + BOTTOM_INSET, transform: `translateY(${-contentScrollY}px)` }}
                                >
                                    <div className="flex flex-col gap-[26px]">
                                        {description.trim() && (
                                            <div>
                                                <SectionHeading title="Description" icon={<FileText className="h-[15px] w-[15px] text-[#FFD60A]" />} />
                                                <Description text={description} />
                                            </div>
                                        )}

                                        <SectionCard title="Campaign Details" icon={<Layers className="h-[15px] w-[15px] text-[#FFD60A]" />}>
                                            {creatorTiers.length > 0 && <DetailRow icon={<Users />} label="Creator Tier" value={creatorTiers.join(', ')} />}
                                            {niches.length > 0 && <DetailRow icon={<Layers />} label="Category" value={niches.join(', ')} />}
                                            {location && <DetailRow icon={<MapPin />} label="Location" value={location} />}
                                            <DetailRow
                                                icon={<FileText />}
                                                label="Script"
                                                value={scriptType === 'brand' ? 'Provided by Brand' : scriptType === 'none' ? 'Not required' : 'Written by Creator'}
                                            />
                                            {usageRights && <DetailRow icon={<ShieldCheck />} label="Usage Rights" value={usageRights} />}
                                        </SectionCard>

                                        {deliverables.length > 0 && (
                                            <SectionCard title="Deliverables" icon={<CheckCircle2 className="h-[15px] w-[15px] text-[#FFD60A]" />}>
                                                {deliverables.map((d) => (
                                                    <div key={d.id} className="flex items-center justify-between py-1.5">
                                                        <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[#F5F5F7]">{d.label}</span>
                                                        <span className="rounded-full border border-[rgba(255,214,10,0.28)] bg-[rgba(255,214,10,0.12)] px-[9px] py-[3px] text-[12px] font-extrabold text-[#FFD60A]">
                                                            ×{d.count}
                                                        </span>
                                                    </div>
                                                ))}
                                                {collabChannel !== null && <CollabBanner channel={collabChannel} />}
                                            </SectionCard>
                                        )}

                                        {references.length > 0 && (
                                            <SectionCard title="References" icon={<Link2 className="h-[15px] w-[15px] text-[#FFD60A]" />} collapsible>
                                                {references.map((url, i) => (
                                                    <div key={i} className="flex items-center justify-between gap-2 py-1">
                                                        <a href={url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2">
                                                            <Link2 className="h-[13px] w-[13px] shrink-0 text-[#0A84FF]" />
                                                            <span className="truncate text-[13.5px] text-[#409CFF]">{url}</span>
                                                        </a>
                                                        <button type="button" aria-label="Copy link" onClick={() => void navigator.clipboard?.writeText(url)}>
                                                            <Copy className="h-3.5 w-3.5 text-[#A1A1AA]" strokeWidth={2} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </SectionCard>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sticky bottom CTA + home indicator */}
                        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.88)] pt-5" style={{ paddingBottom: BOTTOM_INSET }}>
                            <div className="px-5 pt-2">
                                <div className="flex h-14 items-center justify-center rounded-full bg-[#FFD60A] text-[16px] font-extrabold tracking-[-0.3px] text-black gap-2">
                                    {isPrivate && <LockKeyhole className="w-4 h-4 stroke-[2.5]" />}
                                    <span>{isPrivate ? 'Invite Only' : 'Apply Now'}</span>
                                </div>
                            </div>
                            <div aria-hidden className="absolute bottom-2 left-1/2 h-[5px] w-28 -translate-x-1/2 rounded-full bg-white/80" />
                        </div>
                    </div>
                    <div aria-hidden style={{ height: headerZoneEnd + contentMaxScroll }} />
                </div>
            </div>
        </div>
        </div>
    );
}

function StatPill({ icon, text }: { icon: ReactNode; text: string }) {
    return (
        <span className="flex items-center gap-[5px] rounded-full bg-[#FEF3C7] px-2.5 py-[5px] text-[11px] font-extrabold text-[#B45309]">
            {icon}
            {text}
        </span>
    );
}

function SectionHeading({ title, icon }: { title: string; icon?: ReactNode }) {
    return (
        <div className="mb-2.5 flex items-center gap-2">
            {icon}
            <span className="text-[15px] font-bold text-[#F5F5F7]">{title}</span>
        </div>
    );
}

function SectionCard({ title, icon, children, collapsible = false }: { title: string; icon?: ReactNode; children: ReactNode; collapsible?: boolean }) {
    const [open, setOpen] = useState(true);
    return (
        <div>
            <button
                type="button"
                disabled={!collapsible}
                onClick={() => setOpen((v) => !v)}
                className="mb-2.5 flex w-full items-center justify-between text-left disabled:cursor-default"
            >
                <span className="flex items-center gap-2">
                    {icon}
                    <span className="text-[15px] font-bold text-[#F5F5F7]">{title}</span>
                </span>
                {collapsible && (open ? <ChevronUp className="h-4 w-4 text-[#A1A1AA]" /> : <ChevronDown className="h-4 w-4 text-[#A1A1AA]" />)}
            </button>
            {open && (
                <div className="flex flex-col gap-3 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#1A1B1E] p-4">{children}</div>
            )}
        </div>
    );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-2 border-b-[0.5px] border-white/[0.08] py-[9px] last:border-b-0">
            <span className="flex shrink-0 items-center gap-2 text-[13px] font-medium text-[#A1A1AA] [&>svg]:h-[13px] [&>svg]:w-[13px]">
                {icon}
                {label}
            </span>
            <span className="line-clamp-2 max-w-[60%] break-words text-right text-[13px] font-semibold text-[#F5F5F7]">{value}</span>
        </div>
    );
}

/** Collaboration tag card with the app's yellow top stroke (CollabTopStroke). */
function CollabBanner({ channel }: { channel: string }) {
    return (
        <div className="relative mt-2.5 rounded-2xl border border-[rgba(250,203,3,0.22)] bg-[rgba(250,203,3,0.04)] p-3.5">
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[25px] rounded-t-[24px] border-t border-[#FACB03]" />
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                    <Handshake className="h-4 w-4 text-[#FFD60A]" />
                    <span className="text-[13px] font-bold text-[#F5F5F7]">Collaboration Tag</span>
                </span>
                <span className="rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-bold text-[#92400E]">Required</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-[17px] text-[#A1A1AA]">
                You must tag the brand as a collaborator so the post appears on both profiles.
            </p>
            {channel && (
                <a
                    href={`https://instagram.com/${channel}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block rounded-full border border-[#D3AB00] bg-black px-3.5 py-1.5 text-[13px] font-bold text-white"
                >
                    @{channel}
                </a>
            )}
        </div>
    );
}

/**
 * The app's description: clamps to 3 lines ending in an inline "...Show more", expands on tap,
 * and shows a "Show less" row once open. The cut point is measured against the real width.
 */
function Description({ text }: { text: string }) {
    const measureRef = useRef<HTMLParagraphElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [truncated, setTruncated] = useState<string | null>(null);

    useLayoutEffect(() => {
        const el = measureRef.current;
        if (!el) return;
        const measure = () => {
            const maxH = DESCRIPTION_LINE_H * 3 + 1;
            el.textContent = text;
            if (el.offsetHeight <= maxH) {
                setTruncated(null);
                return;
            }
            // Longest prefix that still fits in 3 lines with the inline suffix appended.
            let lo = 0;
            let hi = text.length;
            while (lo < hi) {
                const mid = Math.ceil((lo + hi) / 2);
                el.textContent = `${text.slice(0, mid).trimEnd()} ...Show more`;
                if (el.offsetHeight <= maxH) lo = mid;
                else hi = mid - 1;
            }
            setTruncated(text.slice(0, lo).trimEnd());
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el.parentElement!);
        return () => ro.disconnect();
    }, [text]);

    const textClass = 'whitespace-pre-wrap break-words text-[14px] leading-[22px] text-[#E4E4E7]';
    return (
        <div className="relative mb-3">
            <p ref={measureRef} aria-hidden className={cn(textClass, 'invisible absolute inset-x-0 top-0')} />
            <button type="button" disabled={truncated === null} onClick={() => setExpanded((v) => !v)} className="block w-full text-left disabled:cursor-default">
                <p className={textClass}>
                    {truncated === null || expanded ? text : (
                        <>
                            {truncated}
                            <span className="font-bold text-[#FFD60A]"> ...Show more</span>
                        </>
                    )}
                </p>
                {truncated !== null && expanded && (
                    <span className="mt-2 flex items-center gap-1 text-[13px] font-bold text-[#FFD60A]">
                        Show less
                        <ChevronUp className="h-[13px] w-[13px] text-[rgba(255,214,10,0.8)]" />
                    </span>
                )}
            </button>
        </div>
    );
}
