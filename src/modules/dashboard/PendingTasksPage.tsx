import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft, ChevronRight, ClipboardList, FileText, Package, Upload, Users, type LucideIcon } from 'lucide-react';
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
    tone: string;
    text: string;
    singular: string;
    plural: string;
    action: string;
}[] = [
    { key: 'applications', tab: 'applications', icon: Users, tone: 'text-blue-600 bg-blue-500/10', text: 'text-blue-600', singular: 'application', plural: 'applications', action: 'to review' },
    { key: 'scripts', tab: 'scripts', icon: FileText, tone: 'text-amber-600 bg-amber-500/10', text: 'text-amber-600', singular: 'script', plural: 'scripts', action: 'to review' },
    { key: 'submissions', tab: 'submissions', icon: Upload, tone: 'text-purple-600 bg-purple-500/10', text: 'text-purple-600', singular: 'work item', plural: 'work items', action: 'to review' },
    { key: 'shipments', tab: 'kanban', icon: Package, tone: 'text-orange-600 bg-orange-500/10', text: 'text-orange-600', singular: 'product', plural: 'products', action: 'to ship' },
];

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
    const [filter, setFilter] = useState<PendingKey | 'all'>('all');

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

    return (
        <div className="w-full">
            <PageHeader
                title="Pending Tasks"
                description={`${queue.length} campaign${queue.length !== 1 ? 's' : ''} require your attention`}
                infoTooltip="Campaigns with applications, scripts, shipments, or submissions waiting on your review."
                actions={
                    <Link
                        to="/dashboard"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-premium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                }
            />

            {isLoading ? (
                <div className="flex items-center justify-center min-h-[40vh]">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : queue.length === 0 ? (
                <div className="surface mx-auto flex max-w-xl flex-col items-center justify-center gap-3 rounded-2xl p-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <ClipboardList className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground">All caught up!</p>
                    <p className="text-xs text-muted-foreground">No pending tasks across your campaigns.</p>
                </div>
            ) : (
                <div className="space-y-5">
                    {/* Totals double as filters: pick a kind to see only the campaigns holding it. */}
                    <div className={cn('grid grid-cols-2 gap-3', summaryKinds.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
                        {summaryKinds.map((kind) => {
                            const Icon = kind.icon;
                            const active = filter === kind.key;
                            const count = totals[kind.key];
                            return (
                                <button
                                    key={kind.key}
                                    type="button"
                                    disabled={count === 0}
                                    onClick={() => setFilter(active ? 'all' : kind.key)}
                                    aria-pressed={active}
                                    className={cn(
                                        'surface flex items-center gap-3 rounded-xl p-4 text-left transition-premium disabled:cursor-default disabled:opacity-50',
                                        active ? 'ring-2 ring-foreground/80' : 'hover:bg-secondary/40',
                                    )}
                                >
                                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', kind.tone)}>
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-xl font-semibold leading-none tabular-nums">{count}</span>
                                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                                            {kind.plural.charAt(0).toUpperCase() + kind.plural.slice(1)} {kind.action}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {filter !== 'all' && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            Showing {visible.length} campaign{visible.length !== 1 ? 's' : ''} with {KINDS.find((k) => k.key === filter)?.plural} {KINDS.find((k) => k.key === filter)?.action}
                            <button type="button" onClick={() => setFilter('all')} className="font-medium text-foreground underline underline-offset-2">
                                Show all
                            </button>
                        </div>
                    )}

                    {/* One list, like Notifications: each row is a campaign, its open tasks link
                        straight to the tab that holds them. */}
                    <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                        {visible.map(({ campaign: c, counts, total }) => {
                            const cover = c.thumbnailUrl || c.coverImageUrl || c.thumbnail;
                            return (
                                <div key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                                    <Link to={`/campaigns/${c.id}`} className="group flex min-w-0 flex-1 items-center gap-4">
                                        <ApiImage
                                            src={cover}
                                            alt=""
                                            fallbackText={(c.name || '?').charAt(0).toUpperCase()}
                                            className="h-10 w-10 shrink-0 rounded-lg object-cover text-sm"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground group-hover:underline underline-offset-2" title={c.name}>{c.name}</p>
                                            <p className="mt-0.5 text-sm text-muted-foreground">
                                                <span className="font-medium tabular-nums text-foreground">{total}</span> {total === 1 ? 'task' : 'tasks'} waiting
                                            </p>
                                        </div>
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
                                                        'inline-flex items-center gap-1.5 h-8 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition-premium hover:bg-secondary',
                                                        filter === kind.key && 'bg-secondary',
                                                    )}
                                                >
                                                    <Icon className={cn('h-3.5 w-3.5', kind.text)} />
                                                    <span className="tabular-nums font-semibold">{count}</span>
                                                    {count === 1 ? kind.singular : kind.plural}
                                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
