import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    ArrowRight,
    CheckCheck,
    Clock,
    ChevronRight,
    FileText,
    Handshake,
    History,
    IndianRupee,
    Loader2,
    Megaphone,
    MessageCircle,
    Package,
    Plus,
    Rocket,
    Send,
    Users,
    Wallet,
    type LucideIcon,
} from 'lucide-react';
import { cn, formatCompactCurrency } from '@/lib/utils';
import { useCampaigns } from '@/modules/campaigns/hooks/useCampaigns';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import { useInfluencerSearch } from '@/modules/discover/hooks/useInfluencers';
import { formatDistanceToNow, formatDistanceToNowStrict } from 'date-fns';
import { resolveNotificationUrl, type Notification } from '@/shared/stores/notificationStore';
import {
    CAMPAIGN_PHASE_LABELS,
    getCampaignDisplayStatus,
    getCampaignPhase,
    type CampaignPhase,
} from '@/modules/campaigns/utils/campaignStatus';
import { CampaignRoomSync } from '@/shared/components/CampaignRoomSync';
import { ApiImage } from '@/shared/components/ApiImage';
import { CoverflowCarousel, type CoverflowSlide } from '@/shared/components/CoverflowCarousel';
import { HireManagerButton } from '@/shared/components/HireManagerButton';
import { Tile } from '@/shared/components/BentoUi';
import { useAuthStore } from '@/shared/stores/authStore';
import { MOCK_NOTIFICATIONS } from '@/mocks/data';

// Sample rows for Recent activity while the account has none of its own: the mock notifications,
// re-dated to these ages (in minutes) so they read as recent.
const SAMPLE_ACTIVITY_AGES = [12, 55, 180, 420, 1440];
const sampleActivity = (): Notification[] =>
    MOCK_NOTIFICATIONS.map((item, i) => ({
        ...item,
        createdAt: new Date(Date.now() - SAMPLE_ACTIVITY_AGES[i % SAMPLE_ACTIVITY_AGES.length] * 60_000).toISOString(),
    }));

// The staggered entrance (cards fading up, numbers counting, title rising) plays on the first
// visit after a page load only; coming back to the dashboard later shows it at once.
let entrancePlayed = false;

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
    if (hour < 5) return 'Welcome back';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Welcome back';
}

// Live campaigns: the colour of the dot beside each status (same hues as StatusBadge).
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
// Recent activity: the icon and short label for each kind of update.
const ACTIVITY_KINDS: Record<Notification['type'], { icon: LucideIcon; label: string }> = {
    application: { icon: Users, label: 'Application' },
    script: { icon: FileText, label: 'Script' },
    submission: { icon: Send, label: 'Content' },
    negotiation: { icon: Handshake, label: 'Negotiation' },
    payment: { icon: IndianRupee, label: 'Payment' },
    chat: { icon: MessageCircle, label: 'Message' },
    campaign_invite: { icon: Megaphone, label: 'Invite' },
    system: { icon: CheckCheck, label: 'Update' },
};

/** Counts up from 0 to `value` once (ease-out, ~0.9s); shows the final value at once for reduced motion or a repeat visit. */
function CountUp({ value }: { value: number }) {
    const [shown, setShown] = useState(0);
    const from = useRef(0);
    useEffect(() => {
        if (entrancePlayed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setShown(value);
            from.current = value;
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

// The one look every stat card shares: white with a light yellow tint (a faint wash from the
// top-left warming toward the bottom-right), a yellow icon tile, a soft glow and a faint corner mark.
const STAT_LOOK = {
    card: 'border border-brand/30 bg-card bg-gradient-to-br from-brand/10 via-brand/[0.04] to-brand/25 text-foreground',
    sub: 'text-muted-foreground',
    footer: 'border-border text-muted-foreground',
    tile: 'bg-brand text-black',
    wash: 'bg-brand/30',
    mark: 'text-foreground/[0.05]',
    spinner: 'text-muted-foreground',
};

interface StatCardProps {
    icon: LucideIcon;
    /** Large faint icon in the bottom corner; the card's own icon unless another reads better at that size. */
    markIcon?: LucideIcon;
    title: string;
    subtitle: string;
    /** null while loading */
    value: ReactNode | null;
    footer: ReactNode;
    className?: string;
}

/**
 * Dashboard stat card. Every card shares the same three rows so they line up across the row:
 * header (icon, title) · big number · one-line footer pinned to the bottom. Display only: it links nowhere.
 */
function StatCard({ icon: Icon, markIcon: MarkIcon = Icon, title, subtitle, value, footer, className }: StatCardProps) {
    const t = STAT_LOOK;
    return (
        <section
            className={cn(
                'relative col-span-12 flex animate-fade-up flex-col overflow-hidden rounded-3xl p-4 shadow-card sm:col-span-6 lg:col-span-3',
                t.card,
                className,
            )}
        >
            {/* Quiet decoration in the empty right side: a soft wash of brand yellow in the top corner
                and the card's own icon, large and faint, tucked into the bottom corner. */}
            <span aria-hidden className={cn('pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl', t.wash)} />
            <MarkIcon aria-hidden strokeWidth={1.25} className={cn('pointer-events-none absolute -bottom-5 -right-4 h-28 w-28 -rotate-12', t.mark)} />

            <div className="relative flex h-9 items-center">
                <span className="flex min-w-0 items-center gap-2.5">
                    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', t.tile)}>
                        <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold leading-5">{title}</span>
                        <span className={cn('block truncate text-xs leading-4', t.sub)}>{subtitle}</span>
                    </span>
                </span>
            </div>

            {/* The number, with a short brand-yellow rule under it. */}
            <p className="relative mt-4 flex h-11 items-end font-display text-4xl font-semibold leading-none tracking-tight tabular-nums">
                {value ?? <Loader2 className={cn('h-6 w-6 animate-spin', t.spinner)} />}
            </p>
            <span aria-hidden className="relative mt-2.5 h-[3px] w-8 rounded-full bg-brand" />

            <div className={cn('relative mt-3 border-t border-dashed pt-2.5 text-xs font-medium', t.footer)}>{footer}</div>
        </section>
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


/** Follower counts the way creators quote them: 12.4K, 1.2M. */
const compactCount = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

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
    // True on a repeat visit: skip the staggered entrance (see `entrancePlayed`).
    const still = useRef(entrancePlayed).current;
    useEffect(() => {
        // Marked a moment after mount, so numbers that arrive with the first data load still count up.
        const timer = setTimeout(() => { entrancePlayed = true; }, 2500);
        return () => clearTimeout(timer);
    }, []);
    // All campaigns (for grid preview, budget, pending counts — capped at 100)
    const { data: campaignsData, isLoading: campaignsLoading, error: campaignsError, dataUpdatedAt } = useCampaigns({ limit: 100 });
    // Fetch active campaigns with high limit so client-side expired filter gives an accurate visible count
    const { data: activeCampaignsRaw } = useCampaigns({ limit: 500, status: 'active' });
    const { data: notificationsData, isLoading: notificationsLoading } = useNotifications({ limit: 5 });
    // Creators for the cover flow: the marketplace's best-ranked dozen.
    const { data: influencersData, isLoading: influencersLoading } = useInfluencerSearch({ sort: 'best', limit: 12 });

    const campaigns = campaignsData?.data ?? [];
    const notifications = notificationsData?.data ?? [];
    // No real activity yet: show sample rows so the card isn't empty. They aren't real, so they
    // are labelled, and open the Notifications page instead of a campaign.
    const showingSampleActivity = notifications.length === 0;
    const activity = showingSampleActivity ? sampleActivity() : notifications;

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

    // Creators cover flow: one slide per creator — their photo, and the facts listed under the
    // carousel while they are in the centre.
    const creators = influencersData?.data ?? [];
    const creatorSlides: CoverflowSlide[] = creators.map((creator) => {
        const handle = creator.handle ? String(creator.handle).replace(/^@/, '') : null;
        // Total audience: the API's own figure, else the sum across the creator's platforms.
        const followers = toNumber(creator.followerCount) || (creator.platforms ?? []).reduce((sum, platform) => sum + toNumber(platform.followers), 0);
        const niche = (creator.niches ?? creator.niche ?? []).find(Boolean);
        return {
            id: creator.id,
            alt: creator.userName,
            title: creator.userName,
            subtitle: [handle && `@${handle}`, creator.tier].filter(Boolean).join(' · '),
            cover: (
                <ApiImage
                    src={creator.userAvatarUrl}
                    alt=""
                    fallbackText={(creator.userName || '?').charAt(0).toUpperCase()}
                    className="h-full w-full select-none object-cover text-5xl"
                    placeholderClassName="bg-gradient-to-br from-neutral-700 to-neutral-950 font-display text-brand"
                />
            ),
            meta: [
                { label: 'Followers', value: followers > 0 ? compactCount.format(followers) : '—' },
                { label: 'Engagement', value: creator.engagementRate != null && creator.engagementRate !== '' ? `${creator.engagementRate}%` : '—' },
                ...(niche ? [{ label: 'Niche', value: niche }] : []),
                ...(creator.location ? [{ label: 'Location', value: creator.location }] : []),
            ],
        };
    });
    // The row scrolls round in a ring and should run off both edges of the stage, which takes about
    // ten covers. With fewer creators the set is repeated (ids suffixed) until there are that many.
    const coverRepeats = creators.length >= 2 && creators.length < 10 ? Math.ceil(10 / creators.length) : 1;
    const coverSlides = Array.from({ length: coverRepeats }, (_, round) =>
        creatorSlides.map((slide) => ({ ...slide, id: `${slide.id}-${round}` })),
    ).flat();

    // ── Time context ── when the numbers were fetched, and what changed recently.
    const updatedLabel = dataUpdatedAt ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true }) : null;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newThisWeek = activeCampaigns.filter((c) => new Date(c.createdAt).getTime() >= weekAgo).length;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const budgetThisMonth = campaigns
        .filter((c) => new Date(c.createdAt).getTime() >= monthStart)
        .reduce((sum, c) => sum + toNumber((c as any).budgetTotal || (c as any).budget?.total), 0);

    // ── Overdue ── scripts and work still unreviewed after their deadline. They drop out of the
    // pending counts above (those only count work that is still on time), so without this they
    // would vanish from the dashboard exactly when they matter most.
    const overdueFor = (campaign: any) => {
        const scripts = isDeadlinePassed(campaign?.scriptDeadline ?? campaign?.timeline?.scriptDeadline) ? pendingScriptsFor(campaign) : 0;
        const work = isDeadlinePassed(campaign?.workDeadline ?? campaign?.timeline?.workDeadline) ? pendingSubmissionsFor(campaign) : 0;
        return { scripts, work, total: scripts + work };
    };
    // Needs attention: overdue campaigns first, then the biggest backlog.
    const attentionRows = inProgressCampaigns
        .map((c) => ({ campaign: c, counts: getPendingCounts(c), pending: totalPendingFor(c), overdue: overdueFor(c) }))
        .filter((row) => row.pending + row.overdue.total > 0)
        .sort((a, b) => b.overdue.total - a.overdue.total || b.pending - a.pending);
    const overdueTotal = attentionRows.reduce((sum, row) => sum + row.overdue.total, 0);
    // What that backlog is made of, in the order a campaign reaches it; `start`/`share` are each
    // kind's position and width on the 0–100 bar.
    const attentionKinds = (() => {
        const sums = attentionRows.reduce(
            (acc, row) => ({
                applications: acc.applications + row.counts.pendingApplications,
                scripts: acc.scripts + row.counts.pendingScripts,
                work: acc.work + row.counts.pendingSubmissions,
                ship: acc.ship + row.counts.pendingProductShipments,
            }),
            { applications: 0, scripts: 0, work: 0, ship: 0 },
        );
        const total = sums.applications + sums.scripts + sums.work + sums.ship;
        let start = 0;
        return [
            { key: 'applications', label: 'applications', value: sums.applications, fill: 'fill-foreground', dot: 'bg-foreground' },
            { key: 'scripts', label: 'scripts', value: sums.scripts, fill: 'fill-brand', dot: 'bg-brand ring-1 ring-foreground/20' },
            { key: 'work', label: 'work', value: sums.work, fill: 'fill-foreground/50', dot: 'bg-foreground/50' },
            { key: 'ship', label: 'to ship', value: sums.ship, fill: 'fill-foreground/25', dot: 'bg-foreground/25' },
        ]
            .filter((kind) => kind.value > 0)
            .map((kind) => {
                const share = total > 0 ? (kind.value / total) * 100 : 0;
                const placed = { ...kind, start, share };
                start += share;
                return placed;
            });
    })();

    const titleWords = `${getGreeting()}, ${firstName}`.split(' ');

    // Detail lines for the stat cards — every number here is counted from the same campaigns.
    const activeShown = activeCampaignsCount || activeCampaigns.length;
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

    // Rounded average budget for the Total budget card's footer.
    const averageBudget = campaigns.length > 0 ? Math.round(totalSpend / campaigns.length / 1000) * 1000 : 0;

    // What the content waiting for review is made of — the dotted breakdown in that card's footer.
    const contentParts = [
        { key: 'scripts', label: contentBreakdown.scripts === 1 ? 'script' : 'scripts', value: contentBreakdown.scripts, dot: 'bg-brand ring-1 ring-foreground/20' },
        { key: 'work', label: 'work', value: contentBreakdown.work, dot: 'bg-foreground' },
        { key: 'ship', label: 'to ship', value: contentBreakdown.ship, dot: 'bg-foreground/30' },
    ].filter((part) => part.value > 0);
    const contentSegments = contentParts;

    // No full-page loading gate — each section handles its own inline loading state
    // so Recent Activity and other independent sections remain visible during refetches.

    return (
        <div className={cn('w-full animate-fade-in pb-10', still && 'dash-still')}>
            {/* Header: page name, date and data freshness on one quiet line; the greeting rising in; the actions. */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="flex animate-slide-in-left flex-wrap items-center gap-x-2 text-xs font-medium text-muted-foreground [animation-delay:80ms]">
                        <span className="font-semibold uppercase tracking-[0.1em] text-foreground">Dashboard</span>
                        {updatedLabel && (
                            <>
                                <span aria-hidden className="text-muted-foreground/40">·</span>
                                <span>Updated {updatedLabel}</span>
                            </>
                        )}
                    </p>
                    <h1 className="flex flex-wrap items-center gap-x-[0.28em] font-display text-2xl font-semibold leading-8 tracking-tight sm:text-[28px]">
                        {titleWords.map((word, i) => (
                            <span key={i} className="-mb-1.5 overflow-hidden pb-1.5">
                                <span className={cn('block animate-rise', RISE_DELAYS[Math.min(i, RISE_DELAYS.length - 1)])}>{word}</span>
                            </span>
                        ))}
                    </h1>
                </div>
                <div className="flex gap-2.5">
                    {/* Icon-only here, so the upsell does not compete with the page's one main action. */}
                    <HireManagerButton compact className="h-9 w-9 border-border bg-card text-foreground/70 shadow-sm transition-colors duration-200 hover:border-foreground hover:bg-card hover:text-foreground" />
                    <button
                        type="button"
                        onClick={() => navigate('/campaigns/create?fresh=true')}
                        className="flood-btn group flex h-9 items-center gap-2 rounded-full border border-foreground bg-foreground pl-1 pr-1 text-[13px] sm:pr-4 font-semibold text-background shadow-sm duration-300 ease-out hover:shadow-float active:scale-[0.97]"
                    >
                        <span className="flood-btn-icon grid h-7 w-7 place-items-center rounded-full bg-brand text-black">
                            <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                        </span>
                        <span className="flood-btn-label hidden sm:inline">Create campaign</span>
                    </button>
                </div>
            </div>


            {/* Inline error banner — does not block the rest of the page */}
            {campaignsError && (
                <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Failed to load campaign data. Please refresh the page.
                </div>
            )}

            {/* One big card holds every card on the page: a soft grey panel, so the white cards inside
                still read as separate pieces. */}
            <div className="mt-5 grid grid-cols-12 gap-3 rounded-[32px] bg-secondary/70 p-3 shadow-card ring-1 ring-foreground/[0.06] sm:gap-4 sm:p-4">
                {/* ── Stat cards ── one shared layout (StatCard): header · number · footer.
                    White for the counts; the one black card is the one that asks you to act. */}
                <StatCard
                    icon={Megaphone}
                    markIcon={Rocket}
                    title="Active campaigns"
                    subtitle="Live right now"
                    value={campaignsLoading ? null : <CountUp value={activeShown} />}
                    footer={newThisWeek > 0
                        ? <><strong className="font-semibold text-foreground">+{newThisWeek}</strong> new this week</>
                        : campaigns.length > 0
                            ? <>Live out of <strong className="font-semibold text-foreground">{plural(campaigns.length, 'campaign')}</strong></>
                            : 'No campaigns yet'}
                    className="[animation-delay:0ms]"
                />

                <StatCard
                    icon={Users}
                    title="Pending applications"
                    subtitle="Awaiting your reply"
                    value={campaignsLoading ? null : <CountUp value={pendingApps} />}
                    footer={campaignsAwaitingReplies > 0
                        ? <>Across <strong className="font-semibold text-foreground">{plural(campaignsAwaitingReplies, 'campaign')}</strong></>
                        : 'All caught up'}
                    className="[animation-delay:70ms]"
                />

                <StatCard
                    icon={FileText}
                    title="Content to review"
                    subtitle="Awaiting your approval"
                    value={campaignsLoading ? null : <CountUp value={pendingContent} />}
                    footer={pendingContent === 0 ? 'Nothing waiting' : (
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {contentSegments.map((seg) => (
                                <span key={seg.key} className="flex items-center gap-1.5">
                                    <span className={cn('h-1.5 w-1.5 rounded-full', seg.dot)} />
                                    <strong className="font-semibold text-foreground tabular-nums">{seg.value}</strong> {seg.label}
                                </span>
                            ))}
                        </span>
                    )}
                    className="[animation-delay:140ms]"
                />

                <StatCard
                    icon={IndianRupee}
                    markIcon={Wallet}
                    title="Total budget"
                    subtitle="Committed, all campaigns"
                    value={campaignsLoading ? null : (
                        <>
                            <span className="mr-0.5 text-[22px]">₹</span>
                            {budgetDisplay}
                        </>
                    )}
                    footer={budgetThisMonth > 0
                        ? <><strong className="font-semibold text-foreground">₹{formatCompactCurrency(budgetThisMonth)}</strong> added this month</>
                        : campaigns.length > 0
                            ? <>Avg <strong className="font-semibold text-foreground">₹{formatCompactCurrency(averageBudget)}</strong> per campaign</>
                            : 'No campaigns yet'}
                    className="[animation-delay:210ms]"
                />

                {/* ── Influencers ── the marketplace's top creators as a cover flow (CoverflowCarousel) on a
                    dark stage: one creator in the centre, their facts on a single line underneath. The row
                    drifts right to left on its own and waits while you point at it; drag or use the arrow
                    keys to browse, click a side cover to bring it forward and the front one to open the profile. */}
                <Tile
                    icon={Users}
                    iconClassName="bg-brand text-black"
                    title="Top influencers"
                    description="They scroll by on their own; point at one to hold it."
                    className="lg:col-span-7 [animation-delay:280ms]"
                    aside={creators.length > 0 ? (
                        <span className="flex shrink-0 items-center gap-2">
                            <span className="hidden rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground sm:block">
                                Top {creators.length}
                            </span>
                            <TileLink to="/discover" />
                        </span>
                    ) : undefined}
                >
                    {influencersLoading ? (
                        <div className="min-h-[240px] flex-1 animate-pulse rounded-2xl bg-secondary/60" />
                    ) : creators.length === 0 ? (
                        <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center rounded-2xl bg-secondary/50 px-4 text-center">
                            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-foreground text-brand">
                                <Users className="h-5 w-5" />
                            </span>
                            <p className="mt-3 font-display text-base font-semibold tracking-tight">No creators to show yet</p>
                            <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                                Browse the marketplace to find creators for your campaigns.
                            </p>
                            <Link
                                to="/discover"
                                className="group mt-4 flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background shadow-sm transition-all duration-200 hover:shadow-float active:scale-[0.97]"
                            >
                                Discover creators
                                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-1 flex-col justify-center overflow-hidden rounded-2xl bg-neutral-950 pb-5 text-white">
                            <CoverflowCarousel
                                slides={coverSlides}
                                onActivate={(index) => navigate(`/discover/${creators[index % creators.length].id}`)}
                                autoplay={3200}
                                cardWidth="clamp(100px, 9vw, 128px)"
                                // The covers fade out toward both edges of the stage instead of stopping short of them.
                                frameClassName="py-5 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
                                cardClassName="bg-neutral-800 ring-1 ring-white/10"
                                label="Top influencers"
                                showCaption
                                captionLayout="inline"
                            />
                        </div>
                    )}
                </Tile>

                <Tile
                    icon={AlertCircle}
                    iconClassName="bg-brand text-black"
                    title="Needs attention"
                    description="Overdue first, then the biggest backlog."
                    className="lg:col-span-5 [animation-delay:350ms]"
                >
                    {attentionRows.length === 0 ? (
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
                            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                We'll flag it here when
                            </p>
                            <ul className="mt-1 divide-y divide-border">
                                {ATTENTION_TRIGGERS.map(({ icon: Icon, label }) => (
                                    <li key={label} className="flex items-center gap-3 py-2.5">
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
                                            <Icon className="h-3.5 w-3.5" />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/80">{label}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="flex flex-1 flex-col gap-2.5">
                            {/* Headline: everything waiting as one figure, split by kind in a bar and a legend. */}
                            <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-card bg-gradient-to-br from-brand/10 via-brand/[0.04] to-brand/25 px-3.5 py-3">
                                <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-brand/30 blur-3xl" />
                                <div className="relative flex items-end justify-between gap-3">
                                    <p className="flex items-end gap-2">
                                        <span className="font-display text-3xl font-semibold leading-none tracking-tight tabular-nums">{totalWaiting}</span>
                                        <span className="text-[11px] leading-[14px] text-muted-foreground">
                                            {totalWaiting === 1 ? 'task' : 'tasks'} waiting
                                            <br />
                                            across {plural(attentionRows.length, 'campaign')}
                                        </span>
                                    </p>
                                    {overdueTotal > 0 && (
                                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold tabular-nums text-white">
                                            <Clock className="h-3 w-3" />
                                            {overdueTotal} overdue
                                        </span>
                                    )}
                                </div>
                                {totalWaiting > 0 && (
                                    <>
                                        <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden className="relative mt-2.5 h-1.5 w-full overflow-hidden rounded-full">
                                            <rect width="100" height="6" className="fill-foreground/10" />
                                            {attentionKinds.map((kind) => (
                                                <rect key={kind.key} x={kind.start} width={kind.share} height="6" className={kind.fill} />
                                            ))}
                                        </svg>
                                        <ul className="relative mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[11px]">
                                            {attentionKinds.map((kind) => (
                                                <li key={kind.key} className="flex items-center gap-1.5 text-muted-foreground">
                                                    <span className={cn('h-1.5 w-1.5 rounded-full', kind.dot)} />
                                                    <strong className="font-semibold tabular-nums text-foreground">{kind.value}</strong>
                                                    {kind.label}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>

                            {/* The queue: one small card per campaign, the most urgent marked "Start here". Each
                                kind of waiting work is a chip; the row opens the tab holding what to deal with first. */}
                            <ul className="space-y-1.5">
                                {attentionRows.slice(0, 3).map(({ campaign: c, counts, pending, overdue }, i) => {
                                    const tab =
                                        overdue.scripts > 0 ? 'scripts'
                                        : overdue.work > 0 ? 'submissions'
                                        : counts.pendingScripts > 0 ? 'scripts'
                                        : counts.pendingSubmissions > 0 ? 'submissions'
                                        : counts.pendingApplications > 0 ? 'applications'
                                        : 'kanban';
                                    const chips: { icon: LucideIcon; text: string }[] = [
                                        ...(counts.pendingApplications > 0 ? [{ icon: Users, text: plural(counts.pendingApplications, 'application') }] : []),
                                        ...(counts.pendingScripts > 0 ? [{ icon: FileText, text: plural(counts.pendingScripts, 'script') }] : []),
                                        ...(counts.pendingSubmissions > 0 ? [{ icon: Send, text: plural(counts.pendingSubmissions, 'work item') }] : []),
                                        ...(counts.pendingProductShipments > 0 ? [{ icon: Package, text: `${counts.pendingProductShipments} to ship` }] : []),
                                    ];
                                    const first = i === 0;
                                    return (
                                        <li key={c.id}>
                                            <Link
                                                to={`/campaigns/${c.id}?tab=${tab}`}
                                                className={cn(
                                                    'group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-all duration-200 hover:bg-card hover:shadow-card',
                                                    first ? 'border-brand bg-brand/10 hover:border-foreground/40' : 'border-border bg-secondary/40 hover:border-foreground/25',
                                                )}
                                            >
                                                <span className="relative shrink-0">
                                                    <ApiImage
                                                        src={c.thumbnailUrl || c.thumbnail}
                                                        alt=""
                                                        fallbackText={c.name.charAt(0).toUpperCase()}
                                                        className="h-9 w-9 rounded-lg object-cover text-xs"
                                                        placeholderClassName="bg-gradient-to-br from-neutral-700 to-neutral-950 font-display text-brand"
                                                    />
                                                    {/* How much is waiting here, pinned to the cover. */}
                                                    {pending > 0 && (
                                                        <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-foreground px-1 text-[9px] font-bold tabular-nums text-brand ring-2 ring-card">
                                                            {pending}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-2">
                                                        <span className="truncate text-xs font-semibold leading-[18px]" title={c.name}>{c.name}</span>
                                                        {first && (
                                                            <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-black">Start here</span>
                                                        )}
                                                    </span>
                                                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                                                        {overdue.total > 0 && (
                                                            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-px text-[10px] font-semibold leading-4 text-destructive">
                                                                <Clock className="h-3 w-3" />
                                                                {overdue.total} overdue
                                                            </span>
                                                        )}
                                                        {chips.map(({ icon: ChipIcon, text }) => (
                                                            <span key={text} className="flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-px text-[10px] font-medium leading-4 text-foreground/75">
                                                                <ChipIcon className="h-2.5 w-2.5 stroke-[1.75]" />
                                                                {text}
                                                            </span>
                                                        ))}
                                                    </span>
                                                </span>
                                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground/5 text-foreground/60 transition-all duration-200 group-hover:bg-foreground group-hover:text-brand">
                                                    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                                                </span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>

                            <Link
                                to="/dashboard/pending-tasks"
                                // Full-width button: the flood has to travel much further than on a normal one.
                                className="flood-btn group mt-auto flex h-9 items-center gap-2 rounded-full bg-foreground pl-1 pr-4 text-xs font-semibold text-background duration-500 [--flood-scale:70] hover:shadow-float"
                            >
                                <span className="flood-btn-icon grid h-7 w-7 place-items-center rounded-full bg-brand text-black">
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </span>
                                <span className="flood-btn-label flex-1 pr-7 text-center">
                                    {attentionRows.length > 3 ? `Review all ${attentionRows.length} campaigns` : 'Open pending tasks'}
                                </span>
                            </Link>
                        </div>
                    )}
                </Tile>

                {/* ── Live campaigns ── one small card per live campaign (up to six), in the same grid as
                    Recent activity beside it: cover, name, creators and budget, then status and progress. */}
                <Tile
                    icon={Megaphone}
                    iconClassName="bg-brand text-black"
                    title="Live campaigns"
                    description="Where each one stands, and how far along it is."
                    className="lg:col-span-6 [animation-delay:350ms]"
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
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-[72px] animate-pulse rounded-xl bg-secondary/60" />
                            ))}
                        </div>
                    ) : activeCampaigns.length === 0 ? (
                        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary/50 p-4">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-brand">
                                <Megaphone className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">No live campaigns yet</p>
                                <p className="text-xs leading-5 text-muted-foreground">Launch one and it shows up here with its creators, budget and progress.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/campaigns/create?fresh=true')}
                                className="group flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background shadow-sm transition-all duration-200 hover:shadow-float active:scale-[0.97]"
                            >
                                <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                                Create campaign
                            </button>
                        </div>
                    ) : (
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            {activeCampaigns.slice(0, 6).map((campaign) => {
                                const phase = getCampaignPhase(campaign);
                                const budget = toNumber(campaign.budgetTotal ?? campaign.budget?.total);
                                const progress = Math.max(0, Math.min(100, Math.round(toNumber(campaign.progress))));
                                return (
                                    <li key={campaign.id}>
                                        <Link
                                            to={`/campaigns/${campaign.id}`}
                                            className="group flex h-full items-center gap-2.5 rounded-xl border border-border bg-secondary/40 px-2.5 py-2 transition-all duration-200 hover:border-foreground/25 hover:bg-card hover:shadow-card"
                                        >
                                            <ApiImage
                                                src={campaign.thumbnailUrl || campaign.thumbnail}
                                                alt=""
                                                fallbackText={campaign.name.charAt(0).toUpperCase()}
                                                className="h-9 w-9 shrink-0 rounded-lg object-cover text-xs"
                                                placeholderClassName="bg-gradient-to-br from-neutral-700 to-neutral-950 font-display text-brand"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold uppercase leading-3 tracking-[0.1em] text-muted-foreground">
                                                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', phaseDot(phase))} />
                                                        <span className="truncate">{CAMPAIGN_PHASE_LABELS[phase]}</span>
                                                    </span>
                                                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                                                </span>
                                                <span className="block truncate text-xs font-semibold leading-[18px]" title={campaign.name}>{campaign.name}</span>
                                                <span className="flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
                                                    <span className="tabular-nums">{plural(campaign.creatorsAccepted || 0, 'creator')}</span>
                                                    <span className="text-muted-foreground/40">·</span>
                                                    <span className="truncate font-semibold text-foreground/75 tabular-nums">
                                                        {/* A campaign paid in product has no cash budget; "₹0" read as a mistake. */}
                                                        {budget > 0 ? `₹${formatCompactCurrency(budget)}` : (campaign.budgetMode ?? campaign.budget?.mode) === 'product' ? 'Product only' : 'No budget set'}
                                                    </span>
                                                </span>
                                                {/* Progress: a slim track that fills in brand yellow, the figure beside it. */}
                                                <span className="mt-1 flex items-center gap-2" title={`${progress}% complete`}>
                                                    <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden className="h-1 flex-1 overflow-hidden rounded-full">
                                                        <rect width="100" height="6" className="fill-foreground/10" />
                                                        <rect width={progress} height="6" className="fill-brand" />
                                                    </svg>
                                                    <span className="text-[11px] font-semibold leading-none tabular-nums">{progress}%</span>
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Tile>

                <Tile
                    icon={History}
                    iconClassName="bg-brand text-black"
                    title="Recent activity"
                    description="What happened across your campaigns lately."
                    className="lg:col-span-6 [animation-delay:420ms]"
                    aside={notificationsLoading ? undefined : showingSampleActivity ? (
                        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">Sample data</span>
                    ) : undefined}
                >
                    {notificationsLoading ? (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="h-[62px] animate-pulse rounded-xl bg-secondary/60" />
                            ))}
                        </div>
                    ) : (
                        // One small card per update, like the cards inside the other tiles: what kind it
                        // is and when, then the message and its campaign. The last slot leads to everything.
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            {activity.slice(0, 5).map((item) => {
                                const kind = ACTIVITY_KINDS[item.type] ?? ACTIVITY_KINDS.system;
                                const KindIcon = kind.icon;
                                const text = item.message || item.title;
                                // Generic messages don't say which campaign — name it, unless the message already does.
                                const showCampaign = item.campaignName && !(text || '').includes(item.campaignName);
                                return (
                                    <li key={item.id}>
                                        <Link
                                            to={showingSampleActivity ? '/notifications' : resolveNotificationUrl(item) || '#'}
                                            className="group flex h-full items-start gap-2.5 rounded-xl border border-border bg-secondary/40 px-2.5 py-2 transition-all duration-200 hover:border-foreground/25 hover:bg-card hover:shadow-card"
                                        >
                                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/20 text-foreground transition-colors duration-200 group-hover:bg-brand">
                                                <KindIcon className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-baseline justify-between gap-2">
                                                    <span className="text-[9px] font-bold uppercase leading-3 tracking-[0.1em] text-muted-foreground">{kind.label}</span>
                                                    <span className="shrink-0 text-[11px] leading-3 tabular-nums text-muted-foreground">
                                                        {formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })}
                                                    </span>
                                                </span>
                                                <span className="mt-0.5 line-clamp-2 text-xs font-medium leading-[17px] text-foreground/85 group-hover:text-foreground">{text}</span>
                                                {showCampaign && (
                                                    <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] leading-4 text-muted-foreground">
                                                        <Megaphone className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{item.campaignName}</span>
                                                    </span>
                                                )}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                            <li>
                                <Link
                                    to="/notifications"
                                    className="group flex h-full min-h-[58px] items-center justify-between gap-3 rounded-xl border border-dashed border-foreground/20 px-3 py-2 transition-all duration-200 hover:border-foreground hover:bg-card"
                                >
                                    <span className="min-w-0">
                                        <span className="block text-xs font-semibold">All notifications</span>
                                        <span className="block truncate text-[11px] text-muted-foreground">Everything that has happened so far</span>
                                    </span>
                                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-brand transition-transform duration-200 group-hover:translate-x-0.5">
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </span>
                                </Link>
                            </li>
                        </ul>
                    )}
                </Tile>
            </div>
        </div>
    );
}
