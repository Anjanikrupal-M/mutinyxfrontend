import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    BatteryMedium,
    Camera,
    ChevronLeft,
    Clock,
    FileText,
    IndianRupee,
    Layers,
    Lock,
    MapPin,
    Signal,
    UserCheck,
    Users,
    Wifi,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';

interface PhonePreviewProps {
    name: string;
    brief: string;
    banner: string | null;
    brand: string;
    categories: string[];
    tiers: string[];
    location: string;
    /** Which creators may apply, e.g. "All creators". */
    openTo: string;
    isPrivate: boolean;
    /** Empty until the script step has been reached. */
    script: string;
    usageRights: string;
    applied?: number;
    budget?: number;
}

const rowClass = 'flex h-10 items-center justify-between gap-2';
const termClass = 'flex shrink-0 items-center gap-1 text-neutral-400';
const valueClass = '-mx-1 truncate rounded px-1 font-bold';
const move = 'transition-all duration-300 ease-out';

interface FlashProps {
    as: 'p' | 'dd';
    animate: boolean;
    className: string;
    children: ReactNode;
}

/** Briefly highlights itself when mounted. Give it a `key` of its value so a change re-mounts it. */
function Flash({ as: Tag, animate, className, children }: FlashProps) {
    // Decided once at mount, so values already on screen at page load stay still.
    const [flash] = useState(animate);
    return <Tag className={cn(className, flash && 'animate-flash')}>{children}</Tag>;
}

/**
 * The campaign as creators see it in the MutinyX app, drawn as a phone. Scrolling inside the
 * phone collapses the hero into a compact header, like the real app screen.
 */
export function PhonePreview({
    name,
    brief,
    banner,
    brand,
    categories,
    tiers,
    location,
    openTo,
    isPrivate,
    script,
    usageRights,
    applied = 0,
    budget = 0,
}: PhonePreviewProps) {
    const firstRender = useRef(true);
    useEffect(() => {
        firstRender.current = false;
    }, []);
    const animate = !firstRender.current;

    const [collapsed, setCollapsed] = useState(false);
    const collapsedRef = useRef(collapsed);
    collapsedRef.current = collapsed;
    const frameRef = useRef<HTMLDivElement>(null);
    const detailsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const frame = frameRef.current;
        if (!frame) return;
        let lockedUntil = 0;
        // Native listener: React's onWheel is passive, so it can't stop the page scrolling underneath.
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const now = performance.now();
            if (now < lockedUntil) return;
            const details = detailsRef.current;
            if (!collapsedRef.current) {
                if (e.deltaY > 0) {
                    setCollapsed(true);
                    lockedUntil = now + 400;
                }
            } else if (e.deltaY < 0 && (!details || details.scrollTop <= 0)) {
                setCollapsed(false);
                lockedUntil = now + 400;
            } else {
                details?.scrollBy({ top: e.deltaY });
            }
        };
        frame.addEventListener('wheel', onWheel, { passive: false });
        return () => frame.removeEventListener('wheel', onWheel);
    }, []);

    useEffect(() => {
        if (!collapsed) detailsRef.current?.scrollTo({ top: 0 });
    }, [collapsed]);

    return (
        <div className="relative mx-auto w-[clamp(262px,calc((100vh-160px)*0.47),320px)]">
            {/* Hardware buttons */}
            <span className="absolute -left-[2px] top-[78px] h-5 w-[3px] rounded-l-sm bg-neutral-700" />
            <span className="absolute -left-[2px] top-[112px] h-9 w-[3px] rounded-l-sm bg-neutral-700" />
            <span className="absolute -left-[2px] top-[156px] h-9 w-[3px] rounded-l-sm bg-neutral-700" />
            <span className="absolute -right-[2px] top-[128px] h-14 w-[3px] rounded-r-sm bg-neutral-700" />

            {/* Body: a thin metal rim, a black bezel, then the screen — each radius nests inside the last. */}
            <div className="relative h-[clamp(440px,calc(100vh-160px),700px)] rounded-[44px] bg-gradient-to-b from-neutral-500 via-neutral-800 to-neutral-600 p-[1.5px] shadow-float">
                <div className="h-full rounded-[42.5px] bg-black p-[5px]">
                    <div
                        ref={frameRef}
                        className={cn(
                            'flex h-full flex-col overflow-hidden rounded-[37.5px] text-white transition-colors duration-500',
                            banner ? 'bg-gradient-to-b from-neutral-900 via-stone-800 to-neutral-950' : 'bg-neutral-950',
                        )}
                    >
                        <div className="relative flex h-7 shrink-0 items-center justify-between px-4 pt-0.5 text-[10px] font-semibold">
                            <span>7:12</span>
                            <span className="absolute left-1/2 top-1.5 h-4 w-[58px] -translate-x-1/2 rounded-full bg-black" />
                            <span className="flex items-center gap-0.5">
                                <Signal className="h-[9px] w-[9px]" />
                                <Wifi className="h-[9px] w-[9px]" />
                                <BatteryMedium className="h-[11px] w-[11px]" />
                            </span>
                        </div>

                        <div className="shrink-0 px-2.5 pt-1">
                            <button
                                type="button"
                                aria-label={collapsed ? 'Expand campaign header' : 'Collapse campaign header'}
                                aria-expanded={!collapsed}
                                onClick={() => setCollapsed(!collapsed)}
                                className="grid h-[26px] w-[26px] place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                            >
                                <ChevronLeft className={cn('h-[13px] w-[13px] stroke-[2.5]', move, collapsed && '-rotate-90')} />
                            </button>
                        </div>

                        {/* Hero: every piece is absolutely placed so it can glide between the two layouts. */}
                        <div className={cn('relative shrink-0', move, collapsed ? 'h-[92px]' : 'h-[228px]')}>
                            <div
                                className={cn(
                                    'absolute grid place-items-center overflow-hidden bg-neutral-900 ring-1 ring-white/5',
                                    move,
                                    collapsed
                                        ? 'left-4 top-2 h-[75px] w-14 translate-x-0 rounded-lg'
                                        : 'left-1/2 top-2 h-[140px] w-[106px] -translate-x-1/2 rounded-xl',
                                )}
                            >
                                {banner ? (
                                    <ApiImage key={banner} src={banner} alt="Campaign cover" className="h-full w-full animate-fade-up object-cover" />
                                ) : (
                                    <Camera className="h-4 w-4 text-neutral-600" />
                                )}
                            </div>

                            <div
                                className={cn(
                                    'absolute flex w-max flex-col',
                                    move,
                                    collapsed
                                        ? 'left-[84px] top-3 max-w-[140px] translate-x-0 items-start'
                                        : 'left-1/2 top-[158px] max-w-[208px] -translate-x-1/2 items-center',
                                )}
                            >
                                <Flash
                                    as="p"
                                    key={name}
                                    animate={animate}
                                    className={cn(
                                        'max-w-full truncate rounded font-display text-base font-bold leading-[19px] tracking-tight',
                                        name ? 'text-white' : 'text-neutral-500',
                                    )}
                                >
                                    {name || 'Campaign name'}
                                </Flash>
                                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium leading-[14px]">
                                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-neutral-600 text-[8px] font-bold">
                                        {brand.charAt(0)}
                                    </span>
                                    {brand}
                                </p>
                            </div>

                            <div
                                className={cn(
                                    'absolute left-1/2 top-[203px] flex -translate-x-1/2 gap-1 whitespace-nowrap text-[9.5px] font-semibold leading-none text-amber-700',
                                    move,
                                    collapsed && 'pointer-events-none scale-90 opacity-0',
                                )}
                            >
                                <span className="flex h-[17px] items-center gap-0.5 rounded-full bg-amber-100 px-2">
                                    <Users className="h-2 w-2" /> {applied} Applied
                                </span>
                                <span className="flex h-[17px] items-center gap-0.5 rounded-full bg-amber-100 px-2">
                                    <IndianRupee className="h-2 w-2" /> ₹{budget.toLocaleString('en-IN')}
                                </span>
                                {isPrivate && (
                                    <span className="flex h-[17px] animate-pop items-center gap-0.5 rounded-full bg-white/15 px-2 text-white">
                                        <Lock className="h-2 w-2" /> Invite only
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-[18px] bg-black">
                            <div
                                ref={detailsRef}
                                className={cn(
                                    'h-full px-3 pb-20 pt-3.5 [scrollbar-width:none]',
                                    collapsed ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden',
                                )}
                            >
                                {brief && (
                                    <div className="mb-4">
                                        <p className="flex items-center gap-1 text-xs font-bold leading-[14px]">
                                            <FileText className="h-2.5 w-2.5 text-brand" /> Description
                                        </p>
                                        <p className={cn('mt-1.5 break-words text-[10.5px] leading-[13px] text-neutral-200', !collapsed && 'line-clamp-2')}>
                                            {brief}
                                        </p>
                                    </div>
                                )}

                                <p className="flex items-center gap-1 text-xs font-bold leading-[14px]">
                                    <Layers className="h-2.5 w-2.5 text-brand" /> Campaign Details
                                </p>

                                <dl className="mt-2 divide-y divide-white/5 rounded-xl bg-neutral-900 px-3 text-[10.5px]">
                                    {tiers.length > 0 && (
                                        <div className={rowClass}>
                                            <dt className={termClass}><Users className="h-[9px] w-[9px]" /> Creator Tier</dt>
                                            <Flash as="dd" key={tiers.join()} animate={animate} className={valueClass}>{tiers.join(', ')}</Flash>
                                        </div>
                                    )}
                                    {categories.length > 0 && (
                                        <div className="flex min-h-12 items-center justify-between gap-2 py-2">
                                            <dt className={termClass}><Layers className="h-[9px] w-[9px]" /> Category</dt>
                                            <Flash as="dd" key={categories.join()} animate={animate} className="max-w-[60%] rounded text-right font-bold leading-[12px]">
                                                {categories.join(', ')}
                                            </Flash>
                                        </div>
                                    )}
                                    <div className={rowClass}>
                                        <dt className={termClass}><MapPin className="h-[9px] w-[9px]" /> Location</dt>
                                        <Flash as="dd" key={location} animate={animate} className={valueClass}>{location}</Flash>
                                    </div>
                                    <div className={rowClass}>
                                        <dt className={termClass}><UserCheck className="h-[9px] w-[9px]" /> Open to</dt>
                                        <Flash as="dd" key={openTo} animate={animate} className={valueClass}>{openTo}</Flash>
                                    </div>
                                    {script && (
                                        <div className={rowClass}>
                                            <dt className={termClass}><FileText className="h-[9px] w-[9px]" /> Script</dt>
                                            <Flash as="dd" key={script} animate={animate} className={valueClass}>{script}</Flash>
                                        </div>
                                    )}
                                    {usageRights && (
                                        <div className={rowClass}>
                                            <dt className={termClass}><Clock className="h-[9px] w-[9px]" /> Usage Rights</dt>
                                            <Flash as="dd" key={usageRights} animate={animate} className={valueClass}>{usageRights}</Flash>
                                        </div>
                                    )}
                                </dl>
                            </div>

                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/80 to-transparent" />
                            <div className="absolute inset-x-3 bottom-5 grid h-9 place-items-center rounded-full bg-brand text-[13px] font-bold text-black">
                                Apply Now
                            </div>
                            <span className="absolute bottom-[5px] left-1/2 h-[3px] w-[66px] -translate-x-1/2 rounded-full bg-white/80" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
