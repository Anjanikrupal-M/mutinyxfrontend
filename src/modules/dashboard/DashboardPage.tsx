import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    ArrowRight,
    CheckCheck,
    Clock,
    ChevronRight,
    FileText,
    History,
    IndianRupee,
    Loader2,
    Megaphone,
    Package,
    Plus,
    Send,
    Users,
    Wallet,
    type LucideIcon,
} from 'lucide-react';
import { cn, formatCompactCurrency } from '@/lib/utils';
import { useCampaigns } from '@/modules/campaigns/hooks/useCampaigns';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import { differenceInCalendarDays, formatDistanceToNow } from 'date-fns';
import { resolveNotificationUrl } from '@/shared/stores/notificationStore';
import {
    CAMPAIGN_PHASE_LABELS,
    getCampaignDisplayStatus,
    getCampaignPhase,
    type CampaignPhase,
} from '@/modules/campaigns/utils/campaignStatus';
import { CampaignRoomSync } from '@/shared/components/CampaignRoomSync';
import { ApiImage } from '@/shared/components/ApiImage';
import { HireManagerButton } from '@/shared/components/HireManagerButton';
import { InfoTooltip } from '@/shared/components/InfoTooltip';
import { Tile, choiceClass } from '@/shared/components/BentoUi';
import { useAuthStore } from '@/shared/stores/authStore';

export default function DashboardPage() {
    // Sync active campaign rooms for real-time WebSocket updates
    return (
        <>
            <CampaignRoomSync />
            <DashboardPageContent />
        </>
    );
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 5) return 'Working late';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Working late';
}

// One quiet pill per status; only the dot carries the colour (same hues as StatusBadge).
const PHASE_DOT: Partial<Record<CampaignPhase, string>> = {
    active: 'bg-emerald-500',
    applications_open: 'bg-emerald-500',
    inviting_creators: 'bg-amber-500',
    applications_received: 'bg-blue-500',
    in_progress: 'bg-emerald-500',
    pending_review: 'bg-violet-500',
    past_deadline: 'bg-orange-500',
};
const phaseDot = (phase: CampaignPhase) => PHASE_DOT[phase] ?? 'bg-muted-foreground';

// Title words rise in one after another; literal classes so Tailwind can see each delay.
const RISE_DELAYS = ['[animation-delay:150ms]', '[animation-delay:260ms]', '[animation-delay:370ms]', '[animation-delay:480ms]', '[animation-delay:590ms]'];
/** Counts up from 0 to `value` once (ease-out, ~0.9s); shows the final value at once for reduced motion. */
function CountUp({ value }: { value: number }) {
    const [shown, setShown] = useState(0);
    const from = useRef(0);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setShown(value);
            return;
        }
        const start = performance.now();
        const begin = from.current;
        let frame = 0;
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / 900);
            const eased = 1 - Math.pow(1 - t, 3);
            const next = Math.round(begin + (value - begin) * eased);
            setShown(next);
            from.current = next;
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value]);
    return <>{shown}</>;
}

// Bars and segments grow in one after another (literal classes so Tailwind can see each delay).
const BAR_DELAYS = ['[animation-delay:200ms]', '[animation-delay:260ms]', '[animation-delay:320ms]', '[animation-delay:380ms]', '[animation-delay:440ms]', '[animation-delay:500ms]', '[animation-delay:560ms]'];

// Circumference of the Content donut (r = 22).
const DONUT_LENGTH = 2 * Math.PI * 22;

type StatTone = 'dark' | 'light' | 'brand';
const STAT_TONES: Record<StatTone, { card: string; sub: string; footer: string; tile: string; pill: string; spinner: string }> = {
    dark: {
        card: 'bg-neutral-950 text-white',
        sub: 'text-white/50',
        footer: 'border-white/10 text-white/55',
        tile: 'bg-brand text-black shadow-[0_0_18px_-4px_rgb(250_203_3_/_0.8)]',
        pill: 'border-white/15 bg-white/5 text-white hover:bg-brand hover:text-black',
        spinner: 'text-white/50',
    },
    light: {
        card: 'border border-black/[0.08] bg-white text-black hover:border-black/30',
        sub: 'text-black/50',
        footer: 'border-black/10 text-black/55',
        tile: 'bg-black text-brand',
        pill: 'border-black/10 bg-white text-black hover:bg-black hover:text-brand',
        spinner: 'text-black/40',
    },
    brand: {
        card: 'bg-brand text-black',
        sub: 'text-black/60',
        footer: 'border-black/15 text-black/60',
        tile: 'bg-black text-brand',
        pill: 'border-black/15 bg-black/[0.06] text-black hover:bg-black hover:text-brand',
        spinner: 'text-black/40',
    },
};

interface StatCardProps {
    tone: StatTone;
    icon: LucideIcon;
    title: string;
    subtitle: string;
    action?: { label: string; to: string };
    /** null while loading */
    value: ReactNode | null;
    /** The 44px-tall visual beside the number (gauge, bars, donut). */
    visual: ReactNode;
    footer: ReactNode;
    className?: string;
}

/**
 * Dashboard stat card. Every card shares the same three rows so they line up across the row:
 * header (icon, title, action) · big number with a visual · one-line footer pinned to the bottom.
 */
function StatCard({ tone, icon: Icon, title, subtitle, action, value, visual, footer, className }: StatCardProps) {
    const t = STAT_TONES[tone];

    // 3D tilt: the card leans toward the mouse (max ±7°). The values
    // go into CSS variables read by .stat-3d in index.css; touch pointers are ignored.
    const tilt = (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType !== 'mouse') return;
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        el.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
    };
    const resetTilt = (e: React.PointerEvent<HTMLElement>) => {
        const el = e.currentTarget;
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
    };

    return (
        <section
            onPointerMove={tilt}
            onPointerLeave={resetTilt}
            className={cn(
                'stat-3d group relative col-span-12 flex flex-col overflow-hidden rounded-3xl p-4 shadow-card hover:shadow-float sm:col-span-6 lg:col-span-3',
                t.card,
                className,
            )}
        >
            {/* Surface decoration: a breathing glow on dark, a hover light-sweep on yellow. */}
            {tone === 'dark' && <span aria-hidden className="stat-glow pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand/25 blur-3xl" />}
            {tone === 'brand' && <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />}

            <div className="relative flex h-8 items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2.5">
                    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', t.tile)}>
                        <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold leading-5">{title}</span>
                        <span className={cn('block truncate text-[11px] leading-4', t.sub)}>{subtitle}</span>
                    </span>
                </span>
                {action && <ReviewPill to={action.to} label={action.label} className={t.pill} />}
            </div>

            <div className="relative mt-3 flex h-11 items-end justify-between gap-3">
                <p className="font-display text-[32px] font-semibold leading-none tracking-tight tabular-nums">
                    {value ?? <Loader2 className={cn('h-6 w-6 animate-spin', t.spinner)} />}
                </p>
                <span className="shrink-0">{visual}</span>
            </div>

            <div className={cn('relative mt-3 border-t pt-2.5 text-[11px] font-medium', t.footer)}>{footer}</div>
        </section>
    );
}

/** Seven small bars; the tallest is yellow (black on a yellow card), empty ones are faint stubs. Bars grow in on load. */
function MiniBars({ bars, tone, label }: { bars: { id: string; name: string; value: number }[]; tone: StatTone; label: string }) {
    const max = Math.max(0, ...bars.map((b) => b.value));
    return (
        <svg viewBox="0 0 76 56" className="h-11 w-[60px]" aria-label={label}>
            {bars.map((bar, i) => {
                const h = max > 0 ? Math.max(4, (bar.value / max) * 54) : 4;
                const isTop = max > 0 && bar.value === max;
                const fill = bar.value === 0
                    ? (tone === 'dark' ? 'fill-white/10' : 'fill-black/10')
                    : tone === 'brand'
                        ? (isTop ? 'fill-black' : 'fill-black/35')
                        : isTop ? 'fill-brand' : (tone === 'dark' ? 'fill-white/70' : 'fill-black');
                return (
                    <rect key={bar.id} x={i * 11} y={56 - h} width="7" height={h} rx="2" className={cn('stat-bar', BAR_DELAYS[i], fill)}>
                        <title>{`${bar.name}: ${bar.value.toLocaleString('en-IN')}`}</title>
                    </rect>
                );
            })}
        </svg>
    );
}

/**
 * Rising trend line for the Total budget card: the line draws itself in on load, a soft area
 * fills under it, and the arrowhead keeps nudging up-right. Motion lives in index.css (.trend-arrow*).
 */
function TrendArrow({ label }: { label: string }) {
    return (
        <svg viewBox="0 0 64 44" className="h-11 w-[64px] overflow-visible" aria-label={label}>
            <path d="M2 40 L18 28 L28 33 L44 16 L58 6 L58 44 L2 44 Z" className="trend-arrow-area fill-black/10" />
            <path
                d="M2 40 L18 28 L28 33 L44 16 L58 6"
                pathLength={1}
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="trend-arrow-line stroke-black"
            />
            <g className="trend-arrow-head">
                <path d="M49 5 L59 5 L59 15" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-black" />
            </g>
        </svg>
    );
}

// Circumference of the Active-campaigns gauge (r = 23).
const GAUGE_LENGTH = 2 * Math.PI * 23;

/** Small "Review →" pill on a stat card; fills with the card's accent on hover (pass hover:bg-*). */
function ReviewPill({ to, label = 'Review', className }: { to: string; label?: string; className?: string }) {
    return (
        <Link
            to={to}
            className={cn(
                'group/review flex h-7 shrink-0 items-center gap-1 rounded-full border border-border bg-card/80 pl-2.5 pr-2 text-xs font-semibold text-foreground/80 backdrop-blur transition-all duration-200 hover:border-transparent hover:text-white',
                className,
            )}
        >
            {label}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/review:translate-x-0.5" />
        </Link>
    );
}

const STAT_DELAYS = ['[animation-delay:0ms]', '[animation-delay:70ms]', '[animation-delay:140ms]'];

// What "Needs attention" tracks — listed in its empty state so the card explains itself.
const ATTENTION_TRIGGERS: { icon: LucideIcon; label: string }[] = [
    { icon: Users, label: 'Creators apply to a campaign' },
    { icon: FileText, label: 'A script is sent for your approval' },
    { icon: Send, label: 'Work is submitted for review' },
    { icon: Package, label: 'A product needs shipping' },
];

// Rows fade up one after another (literal classes so Tailwind can see each delay).
const ROW_DELAYS = ['[animation-delay:0ms]', '[animation-delay:60ms]', '[animation-delay:120ms]', '[animation-delay:180ms]', '[animation-delay:240ms]', '[animation-delay:300ms]'];

/** "Applications close in 5 days" / "Applications closed 3 days ago"; soon = within 3 days. */
function applicationTiming(deadline?: string | null): { text: string; short: string; soon: boolean } | null {
    if (!deadline) return null;
    const date = new Date(String(deadline).split('T')[0] + 'T23:59:59');
    if (Number.isNaN(date.getTime())) return null;
    const days = differenceInCalendarDays(date, new Date());
    if (days > 1) return { text: `Applications close in ${days} days`, short: `${days}d left`, soon: days <= 3 };
    if (days === 1) return { text: 'Applications close tomorrow', short: 'Tomorrow', soon: true };
    if (days === 0) return { text: 'Applications close today', short: 'Today', soon: true };
    // Past a month the exact count is just noise.
    if (days < -30) return { text: 'Applications closed', short: 'Closed', soon: false };
    return { text: `Applications closed ${-days} day${days === -1 ? '' : 's'} ago`, short: 'Closed', soon: false };
}

/** Small ring for a campaign's progress, the percentage in its centre. */
function CampaignProgressRing({ value }: { value: number }) {
    const r = 14;
    const length = 2 * Math.PI * r;
    return (
        <span className="relative grid h-9 w-9 shrink-0 place-items-center" title={`${value}% complete`}>
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-secondary" />
                <circle
                    cx="18" cy="18" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={length} strokeDashoffset={length * (1 - value / 100)}
                    className="stroke-brand transition-[stroke-dashoffset] duration-700 ease-out"
                />
            </svg>
            <span className="relative text-[10px] font-bold tabular-nums">{value}</span>
        </span>
    );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function toNumber(v: unknown): number {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function Meta({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
    return (
        <span className="flex items-center gap-1">
            <Icon className="h-3 w-3 stroke-[1.75]" />
            {children}
        </span>
    );
}

/** "View all" link at the right of a tile's header. */
function TileLink({ to }: { to: string }) {
    return (
        <Link
            to={to}
            className="group flex h-8 shrink-0 items-center gap-1 rounded-full border border-border pl-3 pr-2 text-xs font-medium transition-colors hover:border-foreground"
        >
            View all
            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
    );
}

function DashboardPageContent() {
    const user = useAuthStore((s) => s.user);
    const firstName = user?.name?.split(' ')[0] || 'there';
    const navigate = useNavigate();
    const [phaseFilter, setPhaseFilter] = useState<CampaignPhase | null>(null);
    // Flipped one frame after mount so the stat gauge animates from empty to its value.
    const [statsRevealed, setStatsRevealed] = useState(false);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setStatsRevealed(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    // All campaigns (for grid preview, budget, pending counts — capped at 100)
    const { data: campaignsData, isLoading: campaignsLoading, error: campaignsError } = useCampaigns({ limit: 100 });
    // Fetch active campaigns with high limit so client-side expired filter gives an accurate visible count
    const { data: activeCampaignsRaw } = useCampaigns({ limit: 500, status: 'active' });
    const { data: notificationsData, isLoading: notificationsLoading } = useNotifications({ limit: 5 });

    const campaigns = campaignsData?.data ?? [];
    const notifications = notificationsData?.data ?? [];

    const isDeadlinePassed = (value?: string | Date | null) => {
        if (!value) return false;

        const datePart = (() => {
            if (typeof value === 'string') return value.trim().split('T')[0];
            if (value instanceof Date) return value.toISOString().split('T')[0];
            return String(value).trim().split('T')[0];
        })();

        const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return false;

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const deadlineEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
        return deadlineEnd.getTime() < Date.now();
    };

    const pendingProductShipmentsFor = (campaign: any) => Math.max(0, Number(campaign?.pendingProductShipments ?? 0));
    const pendingScriptsFor = (campaign: any) => Math.max(0, Number(campaign?.pendingScripts ?? 0));
    const pendingSubmissionsFor = (campaign: any) => Math.max(0, Number(campaign?.pendingSubmissions ?? 0));
    const pendingApplicationsFor = (campaign: any) => {
        // Only trust the backend's pendingApplications field — it counts only 'applied' status.
        // The old fallback (applicationsCount - creatorsAccepted) wrongly included 'negotiating'
        // and 'rejected' influencers, making campaigns appear pending when they aren't.
        return Math.max(0, Number(campaign?.pendingApplications ?? 0));
    };

    const getPendingCounts = (campaign: any) => {
        const scriptDeadlinePassed = isDeadlinePassed(campaign?.scriptDeadline ?? campaign?.timeline?.scriptDeadline);
        const workDeadlinePassed = isDeadlinePassed(campaign?.workDeadline ?? campaign?.timeline?.workDeadline);
        return {
            pendingApplications: pendingApplicationsFor(campaign),
            pendingProductShipments: pendingProductShipmentsFor(campaign),
            pendingScripts: scriptDeadlinePassed ? 0 : pendingScriptsFor(campaign),
            pendingSubmissions: workDeadlinePassed ? 0 : pendingSubmissionsFor(campaign),
        };
    };

    // Filter client-side for expired so the count matches exactly what CampaignListPage shows at ?status=active
    const allActiveCampaigns = (activeCampaignsRaw?.data ?? []).filter(
        (c) => getCampaignDisplayStatus(c) !== 'expired'
    );
    // Accurate count: from the dedicated active fetch (with expired filtered out)
    const activeCampaignsCount = allActiveCampaigns.length;
    // Local active campaigns for the dashboard preview (from the capped 100 fetch)
    const activeCampaigns = allActiveCampaigns.length > 0
        ? allActiveCampaigns
        : campaigns.filter((c) => getCampaignDisplayStatus(c) === 'active');
    const inProgressCampaigns = campaigns.filter((c) => ['active', 'script', 'work'].includes(getCampaignDisplayStatus(c)));

    const pendingApps = inProgressCampaigns.reduce((sum, c) => sum + getPendingCounts(c).pendingApplications, 0);
    const pendingContent = inProgressCampaigns.reduce(
        (sum, c) =>
            sum +
            Number(getPendingCounts(c).pendingProductShipments ?? 0) +
            Number(getPendingCounts(c).pendingScripts ?? 0) +
            Number(getPendingCounts(c).pendingSubmissions ?? 0),
        0
    );
    const totalSpend = campaigns.reduce((sum, c) => {
        const amount = (c as any).budgetTotal || (c as any).budget?.total || 0;
        const val = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const budgetDisplay = formatCompactCurrency(totalSpend);

    const totalPendingFor = (c: any) => {
        const { pendingApplications, pendingProductShipments, pendingScripts, pendingSubmissions } = getPendingCounts(c);
        return pendingApplications + pendingProductShipments + pendingScripts + pendingSubmissions;
    };
    const pendingTaskCampaigns = inProgressCampaigns
        .filter((c) => totalPendingFor(c) > 0)
        .sort((a, b) => totalPendingFor(b) - totalPendingFor(a));
    const totalWaiting = pendingTaskCampaigns.reduce((sum, c) => sum + totalPendingFor(c), 0);

    // Status filter chips: only the phases the shown campaigns are actually in.
    const previewCampaigns = activeCampaigns.slice(0, 6);
    const phaseOf = new Map(previewCampaigns.map((c) => [c.id, getCampaignPhase(c)]));
    const phases = [...new Set(phaseOf.values())];
    const filteredCampaigns = phaseFilter ? previewCampaigns.filter((c) => phaseOf.get(c.id) === phaseFilter) : previewCampaigns;

    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    const titleWords = `${getGreeting()}, ${firstName}`.split(' ');

    // Detail lines for the stat cards — every number here is counted from the same campaigns.
    const activeShown = activeCampaignsCount || activeCampaigns.length;
    const activeShare = campaigns.length > 0 ? Math.min(100, Math.round((activeShown / campaigns.length) * 100)) : 0;
    const campaignsAwaitingReplies = inProgressCampaigns.filter((c) => getPendingCounts(c).pendingApplications > 0).length;
    const contentBreakdown = inProgressCampaigns.reduce(
        (acc, c) => {
            const counts = getPendingCounts(c);
            return {
                scripts: acc.scripts + counts.pendingScripts,
                work: acc.work + counts.pendingSubmissions,
                ship: acc.ship + counts.pendingProductShipments,
            };
        },
        { scripts: 0, work: 0, ship: 0 },
    );

    // Bar chart: pending applications per in-progress campaign (up to 7 bars).
    const pendingBars = inProgressCampaigns.slice(0, 7).map((c) => ({ id: c.id, name: c.name, value: getPendingCounts(c).pendingApplications }));
    while (pendingBars.length < 7) pendingBars.push({ id: `empty-${pendingBars.length}`, name: 'No campaign', value: 0 });
    // Rounded average budget for the Total budget card's footer.
    const averageBudget = campaigns.length > 0 ? Math.round(totalSpend / campaigns.length / 1000) * 1000 : 0;

    // Split bar: what the content waiting for review is made of, as % of the bar.
    const contentParts = [
        { key: 'scripts', label: contentBreakdown.scripts === 1 ? 'script' : 'scripts', value: contentBreakdown.scripts, fill: 'fill-brand', stroke: 'stroke-brand', dot: 'bg-brand' },
        { key: 'work', label: 'work', value: contentBreakdown.work, fill: 'fill-white/70', stroke: 'stroke-white/70', dot: 'bg-white/70' },
        { key: 'ship', label: 'to ship', value: contentBreakdown.ship, fill: 'fill-white/25', stroke: 'stroke-white/25', dot: 'bg-white/25' },
    ].filter((part) => part.value > 0);
    const contentTotal = contentParts.reduce((sum, part) => sum + part.value, 0);
    let contentOffset = 0;
    const contentSegments = contentParts.map((part) => {
        const width = contentTotal > 0 ? (part.value / contentTotal) * 100 : 0;
        const seg = { ...part, x: contentOffset, width };
        contentOffset += width;
        return seg;
    });

    // No full-page loading gate — each section handles its own inline loading state
    // so Recent Activity and other independent sections remain visible during refetches.

    return (
        <div className="w-full animate-fade-in pb-10">
            {/* Same header as Create Campaign: a small trail, the title rising in word by word, pill buttons. */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="flex animate-slide-in-left items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground [animation-delay:80ms]">
                        Dashboard <ChevronRight className="h-3 w-3" />
                        <span className="text-foreground">{today}</span>
                    </p>
                    <h1 className="flex flex-wrap items-center gap-x-[0.28em] font-display text-2xl font-semibold leading-8 tracking-tight sm:text-[28px]">
                        {titleWords.map((word, i) => (
                            <span key={i} className="-mb-1.5 overflow-hidden pb-1.5">
                                <span className={cn('block animate-rise', RISE_DELAYS[Math.min(i, RISE_DELAYS.length - 1)])}>{word}</span>
                            </span>
                        ))}
                        <span className="ml-1 inline-flex animate-pop [animation-delay:500ms]">
                            <InfoTooltip
                                text="Your daily overview — active campaigns, pending tasks, and recent activity across your brand."
                                side="bottom"
                                iconClassName="h-3.5 w-3.5"
                            />
                        </span>
                    </h1>
                </div>
                <div className="flex gap-2.5">
                    <HireManagerButton className="h-9 gap-2 rounded-full border-border bg-card px-4 text-[13px] font-semibold text-foreground/80 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground hover:bg-card hover:text-foreground hover:shadow-float active:translate-y-0 active:scale-[0.97]" />
                    <button
                        type="button"
                        onClick={() => navigate('/campaigns/create?fresh=true')}
                        className="group flex h-9 items-center gap-2 rounded-full border border-foreground bg-foreground px-4 text-[13px] font-semibold text-background shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.97]"
                    >
                        <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                        <span className="hidden sm:inline">Create campaign</span>
                    </button>
                </div>
            </div>


            {/* Inline error banner — does not block the rest of the page */}
            {campaignsError && (
                <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Failed to load campaign data. Please refresh the page.
                </div>
            )}

            <div className="mt-5 grid grid-cols-12 gap-4">
                {/* The three counts as quiet tiles; the budget is the one dark tile, the way the chosen option is marked elsewhere. */}
                {/* ── Stat cards ── one shared layout (StatCard): header · number + visual · footer,
                    in the landing page's palette — black, white, brand yellow, black. */}
                <StatCard
                    tone="dark"
                    icon={Megaphone}
                    title="Active campaigns"
                    subtitle="Live right now"
                    action={{ label: 'View', to: '/campaigns?status=active' }}
                    value={campaignsLoading ? null : <CountUp value={activeShown} />}
                    visual={
                        <span className="relative grid h-11 w-11 place-items-center">
                            <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden>
                                <circle cx="28" cy="28" r="23" fill="none" strokeWidth="5" className="stroke-white/10" />
                                <circle
                                    cx="28" cy="28" r="23" fill="none" strokeWidth="5" strokeLinecap="round"
                                    strokeDasharray={GAUGE_LENGTH}
                                    strokeDashoffset={statsRevealed ? GAUGE_LENGTH * (1 - activeShare / 100) : GAUGE_LENGTH}
                                    className="stroke-brand transition-[stroke-dashoffset] [transition-duration:1200ms] ease-out [filter:drop-shadow(0_0_4px_rgb(250_203_3_/_0.7))]"
                                />
                            </svg>
                            <span className="relative text-[10px] font-bold tabular-nums">{activeShare}%</span>
                        </span>
                    }
                    footer={campaigns.length > 0
                        ? <>Live out of <strong className="font-semibold text-white">{plural(campaigns.length, 'campaign')}</strong></>
                        : 'No campaigns yet'}
                    className="[animation-delay:0ms]"
                />

                <StatCard
                    tone="dark"
                    icon={Users}
                    title="Pending applications"
                    subtitle="Awaiting your reply"
                    action={{ label: 'Review', to: '/dashboard/pending-tasks' }}
                    value={campaignsLoading ? null : <CountUp value={pendingApps} />}
                    visual={<MiniBars bars={pendingBars} tone="dark" label="Pending applications per campaign" />}
                    footer={campaignsAwaitingReplies > 0
                        ? <>Across <strong className="font-semibold text-white">{plural(campaignsAwaitingReplies, 'campaign')}</strong></>
                        : 'All caught up'}
                    className="[animation-delay:70ms]"
                />

                <StatCard
                    tone="dark"
                    icon={FileText}
                    title="Content to review"
                    subtitle="Awaiting your approval"
                    action={{ label: 'Review', to: '/dashboard/pending-tasks' }}
                    value={campaignsLoading ? null : <CountUp value={pendingContent} />}
                    visual={
                        <svg viewBox="0 0 56 56" className="h-11 w-11 -rotate-90" aria-label="What is waiting for review">
                            <circle cx="28" cy="28" r="22" fill="none" strokeWidth="7" className="stroke-white/10" />
                            {contentSegments.map((seg) => (
                                <circle
                                    key={seg.key}
                                    cx="28" cy="28" r="22" fill="none" strokeWidth="7"
                                    strokeDasharray={`${statsRevealed ? (seg.width / 100) * DONUT_LENGTH : 0} ${DONUT_LENGTH}`}
                                    strokeDashoffset={-(seg.x / 100) * DONUT_LENGTH}
                                    className={cn('transition-[stroke-dasharray] [transition-duration:1100ms] ease-out', seg.stroke)}
                                >
                                    <title>{`${seg.value} ${seg.label}`}</title>
                                </circle>
                            ))}
                        </svg>
                    }
                    footer={pendingContent === 0 ? 'Nothing waiting' : (
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {contentSegments.map((seg) => (
                                <span key={seg.key} className="flex items-center gap-1.5">
                                    <span className={cn('h-1.5 w-1.5 rounded-full', seg.dot)} />
                                    <strong className="font-semibold text-white tabular-nums">{seg.value}</strong> {seg.label}
                                </span>
                            ))}
                        </span>
                    )}
                    className="[animation-delay:140ms]"
                />

                <StatCard
                    tone="brand"
                    icon={IndianRupee}
                    title="Total budget"
                    subtitle="Across all campaigns"
                    action={{ label: 'View', to: '/campaigns' }}
                    value={campaignsLoading ? null : (
                        <>
                            <span className="mr-0.5 text-[22px] text-black">₹</span>
                            {budgetDisplay}
                        </>
                    )}
                    visual={<TrendArrow label="Budget trending up" />}
                    footer={campaigns.length > 0
                        ? <>Avg <strong className="font-semibold text-black">₹{formatCompactCurrency(averageBudget)}</strong> per campaign</>
                        : 'No campaigns yet'}
                    className="[animation-delay:210ms]"
                />

                <Tile
                    icon={Megaphone}
                    title="Active campaigns"
                    description="Live campaigns and where each one stands."
                    className="lg:col-span-7 [animation-delay:280ms]"
                    aside={activeCampaigns.length > 0 ? (
                        <span className="flex shrink-0 items-center gap-2">
                            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:flex">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                </span>
                                {activeCampaignsCount || activeCampaigns.length} live
                            </span>
                            <TileLink to="/campaigns?status=active" />
                        </span>
                    ) : undefined}
                >
                    {campaignsLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-[52px] animate-pulse rounded-2xl bg-secondary/60" />
                            ))}
                        </div>
                    ) : activeCampaigns.length === 0 ? (
                        <div className="relative flex min-h-[260px] flex-1 flex-col">
                            {/* Ghost rows: a faded preview of what this list looks like once campaigns are live. */}
                            <div aria-hidden className="space-y-2 [mask-image:linear-gradient(to_bottom,black_20%,transparent)]">
                                {['w-1/3', 'w-2/5', 'w-1/4'].map((nameWidth, i) => (
                                    <div key={i} className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-2 py-2">
                                        <span className="h-11 w-11 shrink-0 rounded-xl bg-secondary" />
                                        <span className="flex-1 space-y-1.5">
                                            <span className={cn('block h-3 rounded-full bg-secondary', nameWidth)} />
                                            <span className="block h-2.5 w-1/2 rounded-full bg-secondary/70" />
                                        </span>
                                        <span className="h-6 w-20 shrink-0 rounded-full bg-secondary" />
                                    </div>
                                ))}
                            </div>
                            {/* Soft card-coloured halo behind the message so it reads cleanly over the ghost rows. */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(closest-side,hsl(var(--card))_55%,transparent)] px-4 text-center">
                                <span className="relative grid h-12 w-12 animate-pop place-items-center rounded-2xl bg-foreground text-brand shadow-float [animation-delay:350ms]">
                                    <Megaphone className="h-5 w-5" />
                                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-brand ring-2 ring-card" />
                                </span>
                                <p className="mt-3 font-display text-base font-semibold tracking-tight">No live campaigns yet</p>
                                <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                                    Launch one and it shows up here with its creators, budget and where it stands.
                                </p>
                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/campaigns/create?fresh=true')}
                                        className="group flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.97]"
                                    >
                                        <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                                        Create campaign
                                    </button>
                                    <Link
                                        to="/discover"
                                        className="group flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground hover:text-foreground"
                                    >
                                        Browse creators
                                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {/* Status filter: a compact segmented control; the chosen segment lifts out. */}
                            {phases.length > 1 && (
                                <div className="mb-3 inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-full bg-secondary p-0.5 text-[11px]">
                                    {[null, ...phases].map((phase) => {
                                        const active = phaseFilter === phase;
                                        const count = phase === null
                                            ? previewCampaigns.length
                                            : previewCampaigns.filter((c) => phaseOf.get(c.id) === phase).length;
                                        return (
                                            <button
                                                key={phase ?? 'all'}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => setPhaseFilter(phase === null || active ? null : phase)}
                                                className={cn(
                                                    'flex h-6 items-center gap-1.5 rounded-full px-2.5 font-semibold transition-all duration-200',
                                                    active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                                )}
                                            >
                                                {phase && <span className={cn('h-1.5 w-1.5 rounded-full', phaseDot(phase))} />}
                                                {phase ? CAMPAIGN_PHASE_LABELS[phase] : 'All'}
                                                <span className="tabular-nums opacity-60">{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* A slim list in one panel: hairline rows, each with the facts on the left and
                                timing, a progress ring and the status on the right. */}
                            <div key={phaseFilter ?? 'all'} className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                                {filteredCampaigns.map((campaign, i) => {
                                    const phase = phaseOf.get(campaign.id) ?? 'active';
                                    const coverUrl = campaign.thumbnailUrl || campaign.thumbnail;
                                    const budget = toNumber(campaign.budgetTotal ?? campaign.budget?.total);
                                    const progress = Math.max(0, Math.min(100, Math.round(toNumber(campaign.progress))));
                                    const timing = applicationTiming(campaign.applicationDeadline || campaign.deadline);
                                    return (
                                        <Link
                                            key={campaign.id}
                                            to={`/campaigns/${campaign.id}`}
                                            className={cn(
                                                'group flex animate-fade-up items-center gap-3 px-3 py-2.5 transition-colors duration-200 [animation-duration:300ms] hover:bg-secondary/70',
                                                ROW_DELAYS[Math.min(i, ROW_DELAYS.length - 1)],
                                            )}
                                        >
                                            <span className="relative shrink-0">
                                                {coverUrl ? (
                                                    <ApiImage src={coverUrl} alt={campaign.name} className="h-10 w-10 rounded-xl object-cover" />
                                                ) : (
                                                    // Stand-in for a missing cover image
                                                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-950 font-display text-sm font-bold text-brand">
                                                        {campaign.name.charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                                <span className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card', phaseDot(phase))} />
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[13px] font-semibold leading-5">{campaign.name}</span>
                                                <span className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
                                                    <span className="shrink-0 tabular-nums">{plural(campaign.creatorsAccepted || 0, 'creator')}</span>
                                                    <span className="shrink-0 text-muted-foreground/40">·</span>
                                                    <span className="shrink-0 font-semibold text-foreground/75 tabular-nums">₹{formatCompactCurrency(budget)}</span>
                                                    {campaign.location && (
                                                        <>
                                                            <span className="hidden shrink-0 text-muted-foreground/40 sm:inline">·</span>
                                                            <span className="hidden truncate sm:inline">{campaign.location}</span>
                                                        </>
                                                    )}
                                                </span>
                                            </span>

                                            {timing && (
                                                <span
                                                    className={cn(
                                                        'hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold md:flex',
                                                        timing.soon ? 'bg-orange-50 text-orange-600' : 'bg-secondary text-muted-foreground',
                                                    )}
                                                    title={timing.text}
                                                >
                                                    <Clock className="h-3 w-3" />
                                                    {timing.short}
                                                </span>
                                            )}

                                            <CampaignProgressRing value={progress} />

                                            <span className="hidden w-[132px] shrink-0 items-center gap-1.5 truncate text-[11px] font-semibold text-foreground/75 sm:flex">
                                                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', phaseDot(phase))} />
                                                <span className="truncate">{CAMPAIGN_PHASE_LABELS[phase]}</span>
                                            </span>

                                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </Tile>

                <Tile
                    icon={AlertCircle}
                    title="Needs attention"
                    description="Campaigns with something waiting on you."
                    className="lg:col-span-5 [animation-delay:350ms]"
                    aside={
                        totalWaiting > 0 ? (
                            <span className="shrink-0 rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold tabular-nums text-background">
                                {totalWaiting} waiting
                            </span>
                        ) : undefined
                    }
                >
                    {pendingTaskCampaigns.length === 0 ? (
                        <div className="flex flex-1 flex-col">
                            <div className="flex animate-fade-up items-center gap-3 rounded-2xl bg-brand/15 p-3 [animation-delay:400ms]">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-accent-foreground ring-4 ring-brand/25">
                                    <CheckCheck className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold">You're all caught up</p>
                                    <p className="text-xs text-muted-foreground">Nothing is waiting on you right now.</p>
                                </div>
                            </div>
                            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                We'll flag it here when
                            </p>
                            <ul className="mt-1 divide-y divide-border">
                                {ATTENTION_TRIGGERS.map(({ icon: Icon, label }) => (
                                    <li key={label} className="flex items-center gap-3 py-2.5">
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
                                            <Icon className="h-3.5 w-3.5" />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/80">{label}</span>
                                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">0</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="-mx-2 flex flex-1 flex-col">
                            {pendingTaskCampaigns.slice(0, 6).map((c) => {
                                const { pendingApplications, pendingProductShipments, pendingScripts, pendingSubmissions } = getPendingCounts(c);
                                const totalPending = pendingApplications + pendingProductShipments + pendingScripts + pendingSubmissions;
                                const pendingTab =
                                    pendingScripts > 0 ? 'scripts'
                                    : pendingSubmissions > 0 ? 'submissions'
                                    : pendingApplications > 0 ? 'applications'
                                    : 'kanban';
                                return (
                                    <Link
                                        key={c.id}
                                        to={`/campaigns/${c.id}?tab=${pendingTab}`}
                                        className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-secondary"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold">{c.name}</span>
                                            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                                                {pendingApplications > 0 && <Meta icon={Users}>{plural(pendingApplications, 'application')}</Meta>}
                                                {pendingProductShipments > 0 && <Meta icon={Package}>{pendingProductShipments} to ship</Meta>}
                                                {pendingScripts > 0 && <Meta icon={FileText}>{plural(pendingScripts, 'script')}</Meta>}
                                                {pendingSubmissions > 0 && <Meta icon={Send}>{plural(pendingSubmissions, 'work item')}</Meta>}
                                            </span>
                                        </span>
                                        {/* The count in a brand bead, like a picked stop on the builder's age line. */}
                                        <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold tabular-nums text-accent-foreground ring-1 ring-foreground/10">
                                            {totalPending}
                                        </span>
                                    </Link>
                                );
                            })}
                            {pendingTaskCampaigns.length > 6 && (
                                <Link
                                    to="/dashboard/pending-tasks"
                                    className="group mx-2 mt-auto flex items-center justify-center gap-1 rounded-full border border-border py-2 text-xs font-medium transition-colors hover:border-foreground"
                                >
                                    View all {pendingTaskCampaigns.length}
                                    <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                                </Link>
                            )}
                        </div>
                    )}
                </Tile>

                <Tile
                    icon={History}
                    title="Recent activity"
                    description="What happened across your campaigns lately."
                    className="[animation-delay:420ms]"
                >
                    {notificationsLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
                                <History className="h-4 w-4 text-muted-foreground" />
                            </span>
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                        </div>
                    ) : (
                        // A timeline: one rail, a dark bead with a brand core per update.
                        <ol className="relative">
                            {notifications.slice(0, 6).map((item, i, list) => {
                                const text = item.message || item.title;
                                // Generic messages don't say which campaign — name it, unless the message already does.
                                const showCampaign = item.campaignName && !(text || '').includes(item.campaignName);
                                return (
                                    <li key={item.id} className="relative flex gap-4 pb-4 last:pb-0">
                                        {i < list.length - 1 && (
                                            <span className="absolute left-[8px] top-5 h-[calc(100%-12px)] w-0.5 rounded-full bg-border" />
                                        )}
                                        <span className="relative mt-1 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-foreground ring-[1.5px] ring-brand ring-offset-2 ring-offset-card">
                                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                                        </span>
                                        <Link
                                            to={resolveNotificationUrl(item) || '#'}
                                            className="group flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4"
                                        >
                                            <p className="text-[13px] leading-6 text-foreground/80 transition-colors group-hover:text-foreground">
                                                {showCampaign && <span className="font-semibold text-foreground">{item.campaignName} · </span>}
                                                {text}
                                            </p>
                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </Tile>
            </div>
        </div>
    );
}
