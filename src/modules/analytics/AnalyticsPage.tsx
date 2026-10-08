import { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { PageHeader } from '@/shared/components/PageHeader';
import { useAnalyticsOverview, type AnalyticsOverviewFormat } from './hooks/useAnalytics';
import { instagramContentFormatLabel, type InstagramAnalyticsFormat } from '@/modules/campaigns/utils/instagramContentFormat';

const FORMAT_ORDER: InstagramAnalyticsFormat[] = ['reel', 'story-image', 'story-video', 'feed-image', 'feed-video', 'carousel'];

function number(value: number | null | undefined): string {
    return value == null ? '—' : Math.round(value).toLocaleString('en-IN');
}

function durationFromMs(value: number | null | undefined): string {
    if (value == null) return '—';
    if (value < 1000) return `${Math.round(value)} ms`;
    const totalSeconds = Math.round(value / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function metricsFor(section: AnalyticsOverviewFormat) {
    const shared = [
        ['Views', number(section.totalViews)],
        ['Interactions', number(section.totalEngagements)],
        ['Shares', number(section.totalShares)],
    ];
    if (section.format === 'story-image' || section.format === 'story-video') {
        return [...shared, ['Replies', number(section.totalReplies)], ['Follows', number(section.totalFollows)]];
    }
    return [
        ...shared,
        ['Likes', number(section.totalLikes)],
        ['Comments', number(section.totalComments)],
        ['Saved', number(section.totalSaved)],
        ...(section.format === 'reel' ? [['Total watch time', durationFromMs(section.totalWatchTime)]] : []),
    ];
}

export default function AnalyticsPage() {
    const { data, isLoading, error } = useAnalyticsOverview();
    const [selected, setSelected] = useState<InstagramAnalyticsFormat>('reel');
    const formats = useMemo(() => FORMAT_ORDER.map((format) => (
        data?.formats.find((section) => section.format === format)
        ?? { format, label: instagramContentFormatLabel(format), requested: true, proofCount: 0, creatorCount: 0, campaignCount: 0, lastFetchedAt: null, totalReach: null, totalViews: null, totalLikes: null, totalComments: null, totalShares: null, totalSaved: null, totalEngagements: null, totalReplies: null, totalFollows: null, averageWatchTime: null, totalWatchTime: null, engagementRate: null, metricAvailability: {}, campaigns: [], influencers: [] }
    )), [data]);
    const active = formats.find((section) => section.format === selected) ?? formats[0];

    if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (error || !active) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-destructive">Failed to load analytics.</div>;

    return (
        // Full width rather than a 1280px column: this is a data page whose breakdown
        // tables and metric tiles read better with room, and on a wide monitor the cap
        // left several hundred pixels of empty canvas down both sides.
        <div className="w-full space-y-6 animate-fade-in analytics-print-root">
            <PageHeader
                title="Instagram Analytics"
                description="Verified Meta metrics, separated by content format"
                infoTooltip="Metrics include approved proofs verified through the creator's connected Instagram Professional account. Formats are reported separately."
                actions={<button type="button" onClick={() => window.print()} className="analytics-print-hide inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"><Download className="h-3.5 w-3.5" />Download PDF</button>}
            />

            <div className="analytics-print-hide flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Instagram formats">
                {formats.map((section) => <button key={section.format} type="button" role="tab" aria-selected={selected === section.format} onClick={() => setSelected(section.format)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${selected === section.format ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-secondary'}`}>{section.label}</button>)}
            </div>

            <section className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h2 className="text-xl font-bold">{active.label}</h2><p className="text-sm text-muted-foreground">{active.proofCount} approved proofs · {active.creatorCount} creators · {active.campaignCount} campaigns</p></div>
                    <p className="text-xs text-muted-foreground">Last fetched: {active.lastFetchedAt ? new Date(active.lastFetchedAt).toLocaleString() : 'Not fetched'}</p>
                </div>
                {active.proofCount === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No approved, Meta-verified {active.label.toLowerCase()} proofs yet.</div> : <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">{metricsFor(active).map(([label, value]) => <div key={label} className="surface-inset rounded-xl p-3.5"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className="mt-1.5 font-display text-[22px] font-semibold tabular-nums tracking-tight">{value}</p></div>)}</div>}
                <div className="grid gap-4 lg:grid-cols-2">
                    <Breakdown title="By campaign" rows={active.campaigns} />
                    <Breakdown title="By creator" rows={active.influencers} />
                </div>
            </section>
        </div>
    );
}

function Breakdown({ title, rows }: { title: string; rows: AnalyticsOverviewFormat['campaigns'] }) {
    return <div className="overflow-hidden rounded-xl border"><div className="border-b bg-secondary/20 px-4 py-3 text-sm font-bold">{title}</div>{rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No reporting data</p> : <div className="divide-y">{rows.map((row) => <div key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm"><div className="min-w-0"><p className="truncate font-semibold">{row.name}</p>{row.handle ? <p className="truncate text-xs text-muted-foreground">@{row.handle}</p> : null}</div><div className="text-right"><p className="font-bold tabular-nums">{number(row.metrics.totalEngagements)}</p><p className="text-[10px] text-muted-foreground">interactions</p></div></div>)}</div>}</div>;
}
