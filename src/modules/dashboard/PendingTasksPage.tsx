import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCheck, ChevronRight, FileText, ListChecks, Package, Upload, Users, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/shared/components/PageHeader';
import { ApiImage } from '@/shared/components/ApiImage';
import { useCampaigns } from '@/modules/campaigns/hooks/useCampaigns';
import { getCampaignDisplayStatus } from '@/modules/campaigns/utils/campaignStatus';

type PendingKey = 'applications' | 'scripts' | 'submissions' | 'shipments';

/** One kind of review work, in the order a brand usually clears it. `tab` is the campaign
 *  detail tab that holds it (shipments are tracked on the board). */
const KINDS: {
    key: PendingKey;
    tab: string;
    icon: LucideIcon;
    singular: string;
    plural: string;
    action: string;
}[] = [
    { key: 'applications', tab: 'applications', icon: Users, singular: 'application', plural: 'applications', action: 'to review' },
    { key: 'scripts', tab: 'scripts', icon: FileText, singular: 'script', plural: 'scripts', action: 'to review' },
    { key: 'submissions', tab: 'submissions', icon: Upload, singular: 'work item', plural: 'work items', action: 'to review' },
    { key: 'shipments', tab: 'kanban', icon: Package, singular: 'product', plural: 'products', action: 'to ship' },
];

// Tiles and rows fade up one after another (literal classes so Tailwind can see each delay).
const TILE_DELAYS = ['[animation-delay:60ms]', '[animation-delay:120ms]', '[animation-delay:180ms]', '[animation-delay:240ms]'];
const ROW_DELAYS = ['[animation-delay:0ms]', '[animation-delay:50ms]', '[animation-delay:100ms]', '[animation-delay:150ms]', '[animation-delay:200ms]', '[animation-delay:250ms]', '[animation-delay:300ms]', '[animation-delay:350ms]'];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function isDeadlinePassed(value?: string | Date | null) {
    if (!value) return false;
    const datePart = (() => {
        if (typeof value === 'string') return value.trim().split('T')[0];
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return String(value).trim().split('T')[0];
    })();
    const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const deadlineEnd = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
    return deadlineEnd.getTime() < Date.now();
}

function getPendingCounts(c: any): Record<PendingKey, number> {
    const scriptDeadlinePassed = isDeadlinePassed(c?.scriptDeadline ?? c?.timeline?.scriptDeadline);
    const workDeadlinePassed = isDeadlinePassed(c?.workDeadline ?? c?.timeline?.workDeadline);
    return {
        applications: Math.max(0, Number(c?.pendingApplications ?? 0)),
        shipments: Math.max(0, Number(c?.pendingProductShipments ?? 0)),
        scripts: scriptDeadlinePassed ? 0 : Math.max(0, Number(c?.pendingScripts ?? 0)),
        submissions: workDeadlinePassed ? 0 : Math.max(0, Number(c?.pendingSubmissions ?? 0)),
    };
}

export default function PendingTasksPage() {
    const { data: campaignsData, isLoading } = useCampaigns({ limit: 500 });
    // ?kind=applications (etc.) opens the page already filtered, e.g. from a dashboard stat card.
    const [searchParams] = useSearchParams();
    const [filter, setFilter] = useState<PendingKey | 'all'>(() => {
        const kind = searchParams.get('kind');
        return KINDS.some((k) => k.key === kind) ? (kind as PendingKey) : 'all';
    });

    // Busiest campaigns first — the page is a triage queue, so the biggest backlog leads.
    const queue = useMemo(() => {
        const campaigns = campaignsData?.data ?? [];
        return campaigns
            .filter((c) => ['active', 'script', 'work'].includes(getCampaignDisplayStatus(c)))
            .map((c) => {
                const counts = getPendingCounts(c);
                const total = counts.applications + counts.scripts + counts.submissions + counts.shipments;
                return { campaign: c, counts, total };
            })
            .filter((row) => row.total > 0)
            .sort((a, b) => b.total - a.total);
    }, [campaignsData]);

    const totals = useMemo(() => {
        const sum: Record<PendingKey, number> = { applications: 0, scripts: 0, submissions: 0, shipments: 0 };
        for (const row of queue) for (const kind of KINDS) sum[kind.key] += row.counts[kind.key];
        return sum;
    }, [queue]);

    const visible = filter === 'all' ? queue : queue.filter((row) => row.counts[filter] > 0);
    // Shipments only matter to product campaigns; hide the tile when there are none.
    const summaryKinds = KINDS.filter((kind) => kind.key !== 'shipments' || totals.shipments > 0);
    const totalWaiting = queue.reduce((sum, row) => sum + row.total, 0);
    const activeKind = KINDS.find((kind) => kind.key === filter);

    return (
        <div className="w-full animate-fade-in pb-10">
            <PageHeader
                title="Pending Tasks"
                description={`${plural(queue.length, 'campaign')} ${queue.length === 1 ? 'requires' : 'require'} your attention`}
                infoTooltip="Campaigns with applications, scripts, shipments, or submissions waiting on your review."
                animated
                size="lg"
                actions={
                    <Link
                        to="/dashboard"
                        className="flood-btn flood-btn-dark group/back flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-semibold shadow-sm duration-300 hover:border-foreground hover:shadow-float"
                    >
                        <span className="flood-btn-icon flood-btn-grow grid place-items-center">
                            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover/back:-translate-x-0.5" />
                        </span>
                        <span className="flood-btn-label hidden sm:inline">Back to Dashboard</span>
                    </Link>
                }
            />

            {isLoading ? (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-[136px] animate-pulse rounded-3xl bg-secondary/60" />
                        ))}
                    </div>
                    <div className="space-y-2 rounded-3xl bg-card p-4 shadow-card ring-1 ring-foreground/[0.07] sm:p-6">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-secondary/60" />
                        ))}
                    </div>
                </div>
            ) : queue.length === 0 ? (
                <div className="relative mx-auto flex max-w-xl animate-fade-up flex-col items-center overflow-hidden rounded-3xl bg-card px-6 py-14 text-center shadow-card ring-1 ring-foreground/[0.07]">
                    <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-brand/25 blur-3xl" />
                    <span className="relative grid h-14 w-14 animate-pop place-items-center rounded-full bg-brand text-accent-foreground ring-4 ring-brand/25 [animation-delay:250ms]">
                        <CheckCheck className="h-6 w-6" />
                    </span>
                    <p className="relative mt-4 font-display text-lg font-bold tracking-tight">You're all caught up</p>
                    <p className="relative mt-1 max-w-xs text-[13px] leading-5 text-muted-foreground">
                        No applications, scripts, work or shipments are waiting on you right now.
                    </p>
                    <Link
                        to="/campaigns"
                        className="group relative mt-5 flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.97]"
                    >
                        View campaigns
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                </div>
            ) : (
                <div className="space-y-5">
                    {/* Totals double as filters: pick a kind to see only the campaigns holding it.
                        The picked tile turns dark, like the dashboard's stat cards. */}
                    <div className={cn('grid grid-cols-1 gap-4', summaryKinds.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3')}>
                        {summaryKinds.map((kind, i) => {
                            const Icon = kind.icon;
                            const active = filter === kind.key;
                            const count = totals[kind.key];
                            const holders = queue.filter((row) => row.counts[kind.key] > 0).length;
                            const share = totalWaiting > 0 ? Math.round((count / totalWaiting) * 100) : 0;
                            return (
                                <button
                                    key={kind.key}
                                    type="button"
                                    disabled={count === 0}
                                    onClick={() => setFilter(active ? 'all' : kind.key)}
                                    aria-pressed={active}
                                    className={cn(
                                        'group relative flex animate-fade-up flex-col overflow-hidden rounded-3xl p-4 text-left shadow-card transition-all duration-300 ease-out disabled:cursor-default',
                                        TILE_DELAYS[i],
                                        active
                                            ? 'bg-foreground text-background shadow-float'
                                            : 'bg-card ring-1 ring-foreground/[0.07] enabled:hover:-translate-y-0.5 enabled:hover:shadow-float enabled:hover:ring-foreground/30 enabled:active:translate-y-0 enabled:active:scale-[0.99]',
                                    )}
                                >
                                    {active && <span aria-hidden className="stat-glow pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand/25 blur-3xl" />}

                                    <span className="relative flex h-8 items-center justify-between gap-2">
                                        <span className="flex min-w-0 items-center gap-2.5">
                                            <span
                                                className={cn(
                                                    'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-300',
                                                    active
                                                        ? 'bg-brand text-accent-foreground'
                                                        : count === 0
                                                            ? 'bg-secondary text-muted-foreground'
                                                            : 'bg-brand/20 text-foreground group-hover:bg-brand',
                                                )}
                                            >
                                                <Icon className="h-3.5 w-3.5" />
                                            </span>
                                            <span className={cn('truncate text-[13px] font-semibold leading-5', count === 0 && 'text-muted-foreground')}>
                                                {kind.plural.charAt(0).toUpperCase() + kind.plural.slice(1)} {kind.action}
                                            </span>
                                        </span>
                                        {count > 0 && (
                                            <span
                                                className={cn(
                                                    'flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors duration-200',
                                                    active
                                                        ? 'border-background/15 bg-background/5 text-background'
                                                        : 'border-border text-foreground/70 group-hover:border-foreground group-hover:text-foreground',
                                                )}
                                            >
                                                {active ? <>Clear <X className="h-3 w-3" /></> : 'Filter'}
                                            </span>
                                        )}
                                    </span>

                                    <span className="relative mt-3 flex h-11 items-end justify-between gap-3">
                                        <span className={cn('font-display text-[32px] font-semibold leading-none tracking-tight tabular-nums', count === 0 && 'text-muted-foreground/60')}>
                                            {count}
                                        </span>
                                        <span className={cn('pb-0.5 text-[11px] font-semibold tabular-nums', active ? 'text-background/55' : 'text-muted-foreground')}>
                                            {share}% of queue
                                        </span>
                                    </span>

                                    {/* Share of everything waiting, as a slim bar. */}
                                    <svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden className="relative mt-3 h-1 w-full overflow-hidden rounded-full">
                                        <rect width="100" height="4" className={active ? 'fill-background/15' : 'fill-secondary'} />
                                        <rect width={share} height="4" className={active ? 'fill-brand' : 'fill-foreground'} />
                                    </svg>

                                    <span className={cn('relative mt-2.5 text-[11px] font-medium', active ? 'text-background/55' : 'text-muted-foreground')}>
                                        {count === 0 ? 'Nothing waiting' : (
                                            <>Across <strong className={cn('font-semibold', active ? 'text-background' : 'text-foreground')}>{plural(holders, 'campaign')}</strong></>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* One panel, like Support's ticket list: each row is a campaign, its open tasks
                        link straight to the tab that holds them. */}
                    <section className="animate-fade-up rounded-3xl bg-card p-4 shadow-card ring-1 ring-foreground/[0.07] [animation-delay:260ms] sm:p-6">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/20 text-foreground">
                                    <ListChecks className="h-[18px] w-[18px]" />
                                </span>
                                <div className="min-w-0">
                                    <h2 className="font-display text-lg font-bold tracking-tight">Review queue</h2>
                                    <p className="truncate text-[13px] text-muted-foreground">
                                        {activeKind
                                            ? `${plural(visible.length, 'campaign')} with ${activeKind.plural} ${activeKind.action}`
                                            : 'Busiest campaigns first. Jump straight to what needs you.'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {activeKind && (
                                    <button
                                        type="button"
                                        onClick={() => setFilter('all')}
                                        className="flex h-7 animate-pop items-center gap-1 rounded-full border border-border pl-2.5 pr-2 text-xs font-semibold text-foreground/80 transition-colors hover:border-foreground hover:text-foreground"
                                    >
                                        Show all
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                                <span className="rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold tabular-nums text-background">
                                    {activeKind ? totals[activeKind.key] : totalWaiting} waiting
                                </span>
                            </div>
                        </div>

                        <div key={filter} className="space-y-2">
                            {visible.map(({ campaign: c, counts, total }, i) => {
                                const cover = c.thumbnailUrl || c.coverImageUrl || c.thumbnail;
                                return (
                                    <div
                                        key={c.id}
                                        className={cn(
                                            'flex animate-fade-up flex-col gap-3 rounded-2xl bg-secondary/40 p-3 ring-1 ring-foreground/[0.05] transition-colors duration-300 [animation-duration:300ms] hover:bg-secondary/70 sm:flex-row sm:items-center sm:gap-4',
                                            ROW_DELAYS[Math.min(i, ROW_DELAYS.length - 1)],
                                        )}
                                    >
                                        <Link to={`/campaigns/${c.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                                            <span className="relative shrink-0">
                                                <ApiImage
                                                    src={cover}
                                                    alt=""
                                                    fallbackText={(c.name || '?').charAt(0).toUpperCase()}
                                                    className="h-11 w-11 rounded-xl object-cover text-sm"
                                                    placeholderClassName="bg-gradient-to-br from-neutral-700 to-neutral-950 font-display text-brand"
                                                />
                                                {/* The count in a brand bead, as on the dashboard's "Needs attention". */}
                                                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold tabular-nums text-accent-foreground ring-2 ring-card">
                                                    {total}
                                                </span>
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-foreground underline-offset-2 group-hover:underline" title={c.name}>{c.name}</span>
                                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                                    <span className="font-semibold tabular-nums text-foreground/80">{total}</span> {total === 1 ? 'task' : 'tasks'} waiting
                                                </span>
                                            </span>
                                        </Link>

                                        <div className="flex flex-wrap gap-2 pl-14 sm:justify-end sm:pl-0">
                                            {KINDS.filter((kind) => counts[kind.key] > 0).map((kind) => {
                                                const Icon = kind.icon;
                                                const count = counts[kind.key];
                                                return (
                                                    <Link
                                                        key={kind.key}
                                                        to={`/campaigns/${c.id}?tab=${kind.tab}`}
                                                        className={cn(
                                                            'group/chip inline-flex h-8 items-center gap-1.5 rounded-full border pl-1 pr-2 text-xs font-medium transition-all duration-200 hover:border-foreground hover:bg-foreground hover:text-background active:scale-[0.97]',
                                                            filter === kind.key ? 'border-foreground bg-brand/20 text-foreground' : 'border-border bg-card text-foreground/80',
                                                        )}
                                                    >
                                                        <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-foreground transition-colors duration-200 group-hover/chip:bg-brand group-hover/chip:text-accent-foreground">
                                                            <Icon className="h-3 w-3" />
                                                        </span>
                                                        <span className="font-bold tabular-nums">{count}</span>
                                                        {count === 1 ? kind.singular : kind.plural}
                                                        <ChevronRight className="h-3.5 w-3.5 opacity-50 transition-transform duration-200 group-hover/chip:translate-x-0.5 group-hover/chip:opacity-100" />
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
