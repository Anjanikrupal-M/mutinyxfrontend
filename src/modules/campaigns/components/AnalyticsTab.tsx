import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, BarChart3, Bookmark, Check, Clock, ExternalLink, Eye, Grid3x3, Heart, Layers, Loader2, MessageCircle, PieChart, RefreshCw, Reply, Share2, Sparkles, Timer, Trophy, TrendingUp, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Campaign, CampaignInfluencer, ProofReelAnalytics } from '@/shared/types/campaign';
import { EmptyData, Pill } from '@/shared/components/insights/InsightBlocks';
import { RankedBars, SplitBar, type ChartSegment } from '@/shared/components/insights/InsightCharts';
import { AnimatedDonutChart } from '@/shared/components/AnimatedDonutChart';
import { AnimatePresence, motion } from 'framer-motion';
import { toneClasses } from '@/shared/components/insights/insightTones';
import { MediaThumb } from '@/shared/components/MediaThumb';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import { useCampaignAnalytics, useCampaignMetricHistory, type CampaignMetricHistoryPoint, type InstagramFormatMetricTotals, type MetricAvailability } from '../hooks/useCampaignAnalytics';
import { useCampaignProofAnalytics } from '../hooks/useCampaignProofAnalytics';
import { allowedInstagramFormatsFromCampaign, instagramContentFormatLabel, proofInstagramAnalyticsFormat, type InstagramAnalyticsFormat } from '../utils/instagramContentFormat';
import { useRefreshProofAnalytics } from '@/modules/analytics/hooks/useAnalytics';
import { AnalyticsSkeleton } from './TabSkeletons';
import { Skeleton } from '@/shared/ui/skeleton';

interface AnalyticsTabProps {
    campaign: Campaign;
    influencers: CampaignInfluencer[];
    isReadOnly?: boolean;
    publicProofs?: ProofReelAnalytics[];
}

const ALL_FORMATS: InstagramAnalyticsFormat[] = ['reel', 'story-image', 'story-video', 'feed-image', 'feed-video', 'carousel'];

function sumPresent(proofs: ProofReelAnalytics[], read: (proof: ProofReelAnalytics) => number | null | undefined): number | null {
    const values = proofs.map(read).filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function platformNumber(proof: ProofReelAnalytics, key: string): number | null {
    const raw = proof.platformMetrics?.[key];
    const value = raw == null ? null : Number(raw);
    return value != null && Number.isFinite(value) ? value : null;
}

function availability(format: InstagramAnalyticsFormat, key: string, value: number | null): MetricAvailability {
    const unsupported = format.startsWith('story-')
        ? ['likes', 'comments', 'saved', 'totalWatchTime', 'averageWatchTime'].includes(key)
        : format !== 'reel' && ['replies', 'follows', 'totalWatchTime', 'averageWatchTime'].includes(key);
    if (unsupported) return 'not_supported';
    return value == null ? 'not_returned' : 'available';
}

function localSections(contentTypes: string[] | undefined, proofs: ProofReelAnalytics[]): InstagramFormatMetricTotals[] {
    const campaignFormats = allowedInstagramFormatsFromCampaign(contentTypes);
    const requested: InstagramAnalyticsFormat[] = campaignFormats.flatMap((format) => (
        format === 'story' ? ['story-image', 'story-video'] : [format]
    ));
    const observed = proofs.map(proofInstagramAnalyticsFormat).filter((format): format is InstagramAnalyticsFormat => format != null);
    const formats = ALL_FORMATS.filter((format) => requested.includes(format) || observed.includes(format));
    return formats.map((format) => {
        const rows = proofs.filter((proof) => proof.status === 'approved' && proof.metricSource === 'meta_graph' && proofInstagramAnalyticsFormat(proof) === format);
        const totalReach = sumPresent(rows, (proof) => proof.scrapedReach);
        const totalEngagements = sumPresent(rows, (proof) => proof.scrapedTotalInteractions);
        const values = {
            reach: totalReach,
            views: sumPresent(rows, (proof) => proof.scrapedViews),
            likes: sumPresent(rows, (proof) => proof.scrapedLikes),
            comments: sumPresent(rows, (proof) => proof.scrapedComments),
            shares: sumPresent(rows, (proof) => proof.scrapedShares),
            saved: sumPresent(rows, (proof) => proof.scrapedSaved),
            totalInteractions: totalEngagements,
            engagementRate: totalReach != null && totalReach > 0 && totalEngagements != null ? (totalEngagements / totalReach) * 100 : null,
            replies: sumPresent(rows, (proof) => platformNumber(proof, 'replies')),
            follows: sumPresent(rows, (proof) => platformNumber(proof, 'follows')),
            totalWatchTime: sumPresent(rows, (proof) => platformNumber(proof, 'ig_reels_video_view_total_time')),
            averageWatchTime: null,
        };
        return {
            format, label: instagramContentFormatLabel(format), requested: requested.includes(format), proofCount: rows.length,
            creatorCount: new Set(rows.map((proof) => proof.influencerHandle || proof.influencerName)).size,
            lastFetchedAt: rows.map((proof) => proof.metricsFetchedAt).filter(Boolean).sort().at(-1) ?? null,
            totalReach: values.reach, totalViews: values.views, totalLikes: values.likes, totalComments: values.comments,
            totalShares: values.shares, totalSaved: values.saved, totalEngagements: values.totalInteractions,
            totalReplies: values.replies, totalFollows: values.follows, totalWatchTime: values.totalWatchTime,
            averageWatchTime: null, engagementRate: values.engagementRate,
            metricAvailability: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, availability(format, key, value)])),
        } as InstagramFormatMetricTotals;
    });
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

function compactCount(value: number): string {
    if (value >= 1e7) return `${Number((value / 1e7).toFixed(2))} Cr`;
    if (value >= 1e5) return `${Number((value / 1e5).toFixed(2))} L`;
    if (value >= 1e3) return `${Number((value / 1e3).toFixed(1))}K`;
    return String(Math.round(value));
}

function exactCount(value: number | null | undefined): string {
    return value == null ? '—' : Math.round(value).toLocaleString('en-IN');
}

type MetricKind = 'count' | 'duration' | 'percent';

const UNAVAILABLE_COPY: Record<Exclude<MetricAvailability, 'available'>, string> = {
    not_supported: 'Not supported',
    not_returned: 'No data',
    error: 'Fetch error',
};

function metricText(value: number | null | undefined, state: MetricAvailability | undefined, kind: MetricKind) {
    if (state && state !== 'available') return { text: UNAVAILABLE_COPY[state], exact: undefined, muted: true };
    if (value == null) return { text: 'Not fetched', exact: undefined, muted: true };
    if (kind === 'duration') return { text: durationFromMs(value), exact: undefined, muted: false };
    if (kind === 'percent') return { text: `${value.toFixed(2)}%`, exact: undefined, muted: false };
    return { text: compactCount(value), exact: exactCount(value), muted: false };
}

/**
 * A stat card's trend: one slim rounded stem per reporting day, rising to today's total, with the
 * day count and "Today" written underneath. Earlier days are soft yellow, today is solid brand
 * yellow with a small dark cap. Plain flex boxes, so nothing can stretch out of shape.
 */
function TrendBars({ values }: { values: number[] }) {
    if (values.length < 2) return null;
    const max = Math.max(...values) || 1;
    return <div aria-hidden>
        <div className="flex h-10 items-end justify-between gap-1 px-0.5">
            {values.map((value, i) => {
                const isLast = i === values.length - 1;
                return <span key={i} className="relative flex h-full w-2 items-end justify-center">
                    <span
                        className={cn('w-full rounded-full transition-all duration-300', isLast ? 'bg-brand' : 'bg-brand/35 group-hover:bg-brand/50')}
                        style={{ height: `${Math.max(14, (value / max) * 100)}%` }}
                    />
                    {isLast && <span className="absolute h-2 w-2 rounded-full bg-foreground ring-2 ring-card" style={{ bottom: `calc(${Math.max(14, (value / max) * 100)}% - 4px)` }} />}
                </span>;
            })}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-medium text-muted-foreground">
            <span>{values.length} days</span>
            <span className="text-foreground">Today</span>
        </div>
    </div>;
}

/** Growth over the reporting window, first day to today, as a percentage. */
function growthOf(values: number[]): number | null {
    if (values.length < 2 || values[0] <= 0) return null;
    return ((values[values.length - 1] - values[0]) / values[0]) * 100;
}

/** One stat card: icon tile and label, the figure with its growth, a hint, and its daily bars. */
function KpiCell({ label, value, state, kind = 'count', hint, icon: Icon, trend }: {
    label: string;
    value: number | null | undefined;
    state?: MetricAvailability;
    kind?: MetricKind;
    hint?: string;
    icon: typeof Eye;
    trend?: number[];
}) {
    const { text, exact, muted } = metricText(value, state, kind);
    const growth = !muted && trend ? growthOf(trend) : null;
    return <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float">
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand/20 blur-2xl" />
        <div className="relative flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-brand"><Icon className="h-3.5 w-3.5" /></span>
                <span className="truncate">{label}</span>
            </p>
            {growth != null && growth > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-700" title="Growth over the reporting days">
                    <TrendingUp className="h-3 w-3" />
                    {growth >= 100 ? `${(growth / 100 + 1).toFixed(1)}×` : `+${growth.toFixed(0)}%`}
                </span>
            )}
        </div>
        <p
            className={cn('relative mt-3 font-display font-semibold tabular-nums leading-none tracking-tight', muted ? 'text-2xl text-muted-foreground/50' : 'text-3xl')}
            title={exact}
        >
            {muted ? '—' : text}
        </p>
        <p className="relative mt-1.5 truncate text-[11px] text-muted-foreground">{muted ? text : hint}</p>
        <div className="relative mt-auto pt-3">
            {!muted && trend && trend.length > 1
                ? <TrendBars values={trend} />
                // No daily history for this one: a quiet placeholder keeps the cards the same height.
                : <div className="flex h-[58px] items-center justify-center rounded-xl border border-dashed border-foreground/15 text-[10px] font-medium text-muted-foreground" aria-hidden>
                    {muted ? 'Waiting for data' : 'No daily history'}
                </div>}
        </div>
    </div>;
}

function Panel({ title, caption, aside, children, className, icon: Icon }: {
    title: string;
    caption?: string;
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
    icon?: typeof Eye;
}) {
    return <section className={cn('flex min-w-0 flex-col rounded-3xl border border-border bg-card p-5 shadow-card', className)}>
        <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
                {Icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-black"><Icon className="h-4 w-4" /></span>}
                <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-semibold leading-5 tracking-tight">{title}</h3>
                    {caption && <p className="truncate text-xs text-muted-foreground">{caption}</p>}
                </div>
            </div>
            {aside}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>;
}

function Segmented<T extends string>({ options, value, onChange, label }: {
    options: Array<{ key: T; label: string }>;
    value: T;
    onChange: (value: T) => void;
    label: string;
}) {
    return <div className="inline-flex shrink-0 rounded-full bg-secondary p-1" role="tablist" aria-label={label}>
        {options.map((option) => <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={value === option.key}
            onClick={() => onChange(option.key)}
            className={cn('whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-200', value === option.key ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >{option.label}</button>)}
    </div>;
}

const METRIC_TILES: Array<{ label: string; field: keyof InstagramFormatMetricTotals; key: string; kind?: MetricKind; icon: typeof Eye; emphasis?: boolean }> = [
    { label: 'Views', field: 'totalViews', key: 'views', icon: Eye },
    { label: 'Reach', field: 'totalReach', key: 'reach', icon: Users },
    { label: 'Interactions', field: 'totalEngagements', key: 'totalInteractions', icon: Activity },
    { label: 'Engagement rate', field: 'engagementRate', key: 'engagementRate', kind: 'percent', icon: TrendingUp },
    { label: 'Likes', field: 'totalLikes', key: 'likes', icon: Heart },
    { label: 'Comments', field: 'totalComments', key: 'comments', icon: MessageCircle },
    { label: 'Shares', field: 'totalShares', key: 'shares', icon: Share2 },
    { label: 'Saved', field: 'totalSaved', key: 'saved', icon: Bookmark },
    { label: 'Replies', field: 'totalReplies', key: 'replies', icon: Reply },
    { label: 'Follows', field: 'totalFollows', key: 'follows', icon: UserPlus },
    { label: 'Total watch time', field: 'totalWatchTime', key: 'totalWatchTime', kind: 'duration', icon: Clock },
    { label: 'Avg. watch time', field: 'averageWatchTime', key: 'averageWatchTime', kind: 'duration', icon: Timer },
];

// Same validated categorical steps as shared/components/insights/InsightCharts (blue · teal · amber).
const TREND_SERIES = [
    { key: 'views', name: 'Views', color: '#5598e7' },
    { key: 'reach', name: 'Reach', color: '#1baf7a' },
    { key: 'totalInteractions', name: 'Interactions', color: '#eda100' },
] as const;

const shortDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const longDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function TrendChart({ points, platform, heightClass = 'h-44' }: { points: CampaignMetricHistoryPoint[]; platform: string; heightClass?: string }) {
    const series = TREND_SERIES.filter((entry) => entry.key !== 'reach' || platform === 'instagram');

    return <div>
        <ul className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
            {series.map((entry) => <li key={entry.key} className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-semibold text-foreground/80">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
                {entry.name}
            </li>)}
        </ul>
        <div className={cn(heightClass, 'w-full')}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                        {series.map((entry) => <linearGradient key={entry.key} id={`trend-wash-${platform}-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={entry.color} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={entry.color} stopOpacity={0.01} />
                        </linearGradient>)}
                    </defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} minTickGap={20} tickFormatter={shortDate} />
                    <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value: number) => compactCount(value)} />
                    <Tooltip
                        cursor={{ stroke: 'hsl(var(--foreground))', strokeOpacity: 0.25, strokeDasharray: '3 3' }}
                        content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return <div className="rounded-2xl border border-border bg-popover px-3 py-2 text-xs shadow-float">
                                <p className="text-[11px] text-muted-foreground">{longDate(String(label))}</p>
                                {payload.map((item) => <p key={String(item.dataKey)} className="mt-0.5 flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
                                    <span className="text-foreground/80">{item.name}</span>
                                    <span className="ml-auto pl-2.5 font-semibold tabular-nums">{exactCount(item.value as number | null)}</span>
                                </p>)}
                            </div>;
                        }}
                    />
                    {series.map((entry) => <Area
                        key={entry.key}
                        type="monotone"
                        dataKey={entry.key}
                        name={entry.name}
                        stroke={entry.color}
                        strokeWidth={2}
                        fill={`url(#trend-wash-${platform}-${entry.key})`}
                        dot={points.length <= 10 ? { r: 2.5, strokeWidth: 0, fill: entry.color } : false}
                        activeDot={{ r: 4, stroke: 'hsl(var(--card))', strokeWidth: 2, fill: entry.color }}
                    />)}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>;
}

const UNVERIFIED_REASON: Record<string, string> = {
    INSTAGRAM_VERIFICATION_UNAVAILABLE: 'the creator has not connected Instagram',
    META_AUTH_INVALID: 'the creator needs to reconnect Instagram',
};

function UnverifiedNotice({ proofs }: { proofs: ProofReelAnalytics[] }) {
    const unverified = proofs.filter((proof) => proof.status === 'approved' && proof.metricSource !== 'meta_graph');
    if (unverified.length === 0) return null;
    const reasons = [...new Set(unverified.map((proof) => (proof.metricErrorCode && UNVERIFIED_REASON[proof.metricErrorCode]) || 'they have not been verified yet'))];
    return <div className={cn('flex items-center gap-3 rounded-xl border px-3.5 py-2.5', toneClasses.warn)}>
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs leading-normal">
            <span className="font-semibold">{unverified.length} approved proof{unverified.length === 1 ? '' : 's'} not counted:</span>{' '}
            <span className="text-foreground/75">Only Meta-verified metrics are included — {reasons.join('; ')}.</span>
        </p>
    </div>;
}

function campaignHeadline(sections: InstagramFormatMetricTotals[]) {
    const total = (read: (section: InstagramFormatMetricTotals) => number | null) => {
        const values = sections.map(read).filter((value): value is number => value != null);
        return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
    };
    const views = total((section) => section.totalViews);
    const reach = total((section) => section.totalReach);
    const interactions = total((section) => section.totalEngagements);
    const mix = [
        { name: 'Likes', value: total((section) => section.totalLikes) },
        { name: 'Comments', value: total((section) => section.totalComments) },
        { name: 'Shares', value: total((section) => section.totalShares) },
        { name: 'Saved', value: total((section) => section.totalSaved) },
    ].filter((entry): entry is { name: string; value: number } => entry.value != null)
        .sort((a, b) => b.value - a.value);
    const totals: Partial<Record<keyof InstagramFormatMetricTotals, number | null>> = {};
    for (const tile of METRIC_TILES) {
        totals[tile.field] = total((section) => section[tile.field] as number | null);
    }
    
    return {
        views,
        reach,
        interactions,
        mix,
        totals,
        proofCount: sections.reduce((sum, section) => sum + section.proofCount, 0),
        formatsWithProofs: sections.filter((section) => section.proofCount > 0).length,
        engagementRate: reach != null && reach > 0 && interactions != null ? (interactions / reach) * 100 : null,
    };
}

function StoryStatusBadge({ proof, className }: { proof?: ProofReelAnalytics | null; className?: string }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!proof?.providerExpiresAt) return undefined;
        const isLive = new Date(proof.providerExpiresAt).getTime() > Date.now();
        if (!isLive) return undefined;
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, [proof?.providerExpiresAt]);

    if (!proof) return null;

    const isCapturedOrFrozen = proof.finalCaptureStatus === 'captured' || proof.isFinal || proof.metricStatus === 'frozen';
    if (isCapturedOrFrozen) {
        return (
            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap', className)}>
                <Check className="h-3 w-3" />
                Final snapshot frozen
            </span>
        );
    }

    if (proof.finalCaptureStatus === 'missed') {
        return (
            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap', className)}>
                <AlertTriangle className="h-3 w-3" />
                Snapshot missed · showing last live values
            </span>
        );
    }

    const expiry = proof.providerExpiresAt ? new Date(proof.providerExpiresAt).getTime() : Number.NaN;
    if (Number.isFinite(expiry) && expiry > now) {
        const remainingMinutes = Math.max(0, Math.ceil((expiry - now) / 60_000));
        const hours = Math.floor(remainingMinutes / 60);
        const minutes = remainingMinutes % 60;
        return (
            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 whitespace-nowrap', className)}>
                Live Story · expires in {hours}h {minutes}m
            </span>
        );
    }

    return (
        <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground border border-border whitespace-nowrap', className)}>
            <Clock className="h-3 w-3" />
            Story expired · metrics preserved
        </span>
    );
}

function StoryFormatLifecycleBanner({ formatProofs, label }: { formatProofs: ProofReelAnalytics[]; label: string }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const hasLive = formatProofs.some(p => p.providerExpiresAt && new Date(p.providerExpiresAt).getTime() > Date.now());
        if (!hasLive) return undefined;
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, [formatProofs]);

    if (formatProofs.length === 0) {
        return (
            <div className={cn('flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs', toneClasses.neutral)}>
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">No approved {label.toLowerCase()} proof yet. Once approved, live metrics will be captured automatically.</p>
            </div>
        );
    }

    const liveProofs = formatProofs.filter(p => {
        const expiry = p.providerExpiresAt ? new Date(p.providerExpiresAt).getTime() : 0;
        return expiry > now && p.metricStatus !== 'frozen' && !p.isFinal && p.finalCaptureStatus !== 'captured';
    });

    const frozenProofs = formatProofs.filter(p => p.metricStatus === 'frozen' || p.isFinal || p.finalCaptureStatus === 'captured');

    const nextExpiring = liveProofs.length > 0
        ? [...liveProofs].sort((a, b) => new Date(a.providerExpiresAt!).getTime() - new Date(b.providerExpiresAt!).getTime())[0]
        : null;

    let countdownText = '';
    if (nextExpiring && nextExpiring.providerExpiresAt) {
        const remaining = Math.max(0, Math.ceil((new Date(nextExpiring.providerExpiresAt).getTime() - now) / 60_000));
        const hours = Math.floor(remaining / 60);
        const minutes = remaining % 60;
        countdownText = `${hours}h ${minutes}m`;
    }

    return (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Story 24h Lifecycle &amp; Preservation</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {liveProofs.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            {liveProofs.length} Live · next expires in {countdownText}
                        </span>
                    ) : null}
                    {frozenProofs.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            {frozenProofs.length} Final Snapshot{frozenProofs.length === 1 ? '' : 's'} Frozen
                        </span>
                    ) : null}
                </div>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
                Instagram Stories expire 24h after posting. Metrics are tracked live, then snapshotted and frozen 22.5h after posting — before Instagram removes the Story — so reporting is preserved.
            </p>
        </div>
    );
}

// One colour per kind of interaction, tied to the interaction (never to its rank) so a filter that
// reorders the mix never repaints it. Gold leads to match the brand. Validated with the dataviz
// palette checker on the light card surface: lightness, chroma, colour-blind (worst ΔE 11.3) and
// normal-vision separation all pass; gold is below 3:1 contrast, so every segment is also labelled
// with its value and share in the legend beside the ring.
const ENGAGEMENT_COLORS: Record<string, string> = {
    Likes: '#d4a100',
    Comments: '#4f5bd5',
    Shares: '#e0703a',
    Saved: '#2f9e8f',
};

/**
 * How the audience engaged: an animated donut of the interaction mix (hover a segment or a legend
 * row to see its count and share in the centre), plus the quieter signals Meta returns.
 */
function EngagementBreakdown({ mix, facts }: {
    mix: Array<{ name: string; value: number }>;
    facts: Array<{ label: string; value: string; icon: typeof Eye }>;
}) {
    const [hovered, setHovered] = useState<string | null>(null);
    const segments = mix
        .filter((item) => item.value > 0)
        .map((item) => ({ label: item.name, value: item.value, color: ENGAGEMENT_COLORS[item.name] ?? '#8a8a8a' }));
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    const active = segments.find((segment) => segment.label === hovered) ?? null;

    return <div className="flex flex-1 flex-col gap-4">
        {total > 0 ? <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <AnimatedDonutChart
                data={segments}
                size={168}
                strokeWidth={22}
                animationDuration={1.2}
                animationDelayPerSegment={0.08}
                activeLabel={hovered}
                onSegmentHover={(segment) => setHovered(segment?.label ?? null)}
                className="shrink-0"
                centerContent={
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={active?.label ?? 'total'}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.18, ease: 'circOut' }}
                            className="flex flex-col items-center text-center"
                        >
                            <span className="max-w-[96px] truncate text-[11px] font-medium text-muted-foreground">{active?.label ?? 'Interactions'}</span>
                            <span className="font-display text-2xl font-semibold leading-tight tabular-nums">{compactCount(active?.value ?? total)}</span>
                            {active && <span className="text-xs font-semibold tabular-nums text-muted-foreground">{((active.value / total) * 100).toFixed(0)}%</span>}
                        </motion.div>
                    </AnimatePresence>
                }
            />
            {/* Legend — also the labels for every segment, so no share relies on colour alone. */}
            <ul className="w-full min-w-0 flex-1 space-y-1">
                {segments.map((segment, index) => <motion.li
                    key={segment.label}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.08, duration: 0.3 }}
                    onMouseEnter={() => setHovered(segment.label)}
                    onMouseLeave={() => setHovered(null)}
                    className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs transition-colors duration-200', hovered === segment.label ? 'bg-secondary' : 'hover:bg-secondary/60')}
                >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{segment.label}</span>
                    <span className="tabular-nums text-muted-foreground">{compactCount(segment.value)}</span>
                    <span className="w-11 text-right font-semibold tabular-nums">{((segment.value / total) * 100).toFixed(1)}%</span>
                </motion.li>)}
            </ul>
        </div> : <p className="py-2 text-xs text-muted-foreground">No verified interactions yet.</p>}
        {facts.length > 0 && <dl className="mt-auto grid grid-cols-2 gap-2">
            {facts.map((fact) => <div key={fact.label} className="min-w-0 rounded-2xl border border-border bg-secondary/40 px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><fact.icon className="h-3 w-3 shrink-0" />{fact.label}</dt>
                <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{fact.value}</dd>
            </div>)}
        </dl>}
    </div>;
}

/** Everything recorded for one approved post, plus its own daily history when there is one. */
function ProofDetailDialog({ proof, formatLabel, points, onClose }: {
    proof: ProofReelAnalytics;
    formatLabel: string;
    points: CampaignMetricHistoryPoint[];
    onClose: () => void;
}) {
    const engagement = proof.scrapedEngagementRate != null && proof.scrapedEngagementRate !== '' ? Number(proof.scrapedEngagementRate) : null;
    const avgWatch = platformNumber(proof, 'ig_reels_avg_watch_time');
    const totalWatch = platformNumber(proof, 'ig_reels_video_view_total_time');
    const caption = typeof proof.platformMetrics?.caption === 'string' ? proof.platformMetrics.caption : null;
    const postedAt = typeof proof.platformMetrics?.timestamp === 'string' ? proof.platformMetrics.timestamp : null;
    const metrics = [
        { label: 'Views', value: proof.scrapedViews, icon: Eye },
        { label: 'Reach', value: proof.scrapedReach, icon: Users },
        { label: 'Interactions', value: proof.scrapedTotalInteractions, icon: Activity },
        { label: 'Likes', value: proof.scrapedLikes, icon: Heart },
        { label: 'Comments', value: proof.scrapedComments, icon: MessageCircle },
        { label: 'Shares', value: proof.scrapedShares, icon: Share2 },
        { label: 'Saves', value: proof.scrapedSaved, icon: Bookmark },
    ].filter((metric) => metric.value != null);
    const extras = [
        engagement != null && Number.isFinite(engagement) ? { label: 'Engagement rate', value: `${engagement.toFixed(2)}%`, icon: TrendingUp } : null,
        avgWatch != null ? { label: 'Avg. watch time', value: durationFromMs(avgWatch), icon: Timer } : null,
        totalWatch != null ? { label: 'Total watch time', value: durationFromMs(totalWatch), icon: Clock } : null,
    ].filter((item): item is { label: string; value: string; icon: typeof Eye } => item != null);
    const days = new Set(points.map((point) => point.date)).size;
    const verified = proof.metricSource === 'meta_graph';

    return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden gap-0">
            <div className="grid max-h-[88vh] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <div className="relative bg-secondary">
                    <MediaThumb src={proof.thumbnailUrl} alt={`${formatLabel} by ${proof.influencerName || 'creator'}`} className="aspect-[4/5] md:aspect-auto md:h-full" />
                </div>
                <div className="min-w-0 overflow-y-auto p-5 space-y-4">
                    <div className="pr-8">
                        <DialogTitle className="text-base font-semibold leading-tight">
                            {proof.influencerName || 'Creator'}
                            {proof.influencerHandle && <span className="font-normal text-muted-foreground"> · @{proof.influencerHandle}</span>}
                        </DialogTitle>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Pill tone="neutral">{formatLabel}</Pill>
                            <Pill tone={verified ? 'good' : 'warn'}>{verified ? 'Meta verified' : 'Not Meta-verified'}</Pill>
                            {proof.metricStatus && <Pill tone="neutral">{proof.metricStatus}</Pill>}
                            {(formatLabel.toLowerCase().includes('story') || proof.contentFormat?.startsWith('story')) && (
                                <StoryStatusBadge proof={proof} />
                            )}
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                            {postedAt && <>Posted {longDate(postedAt.slice(0, 10))} · </>}
                            {proof.metricsFetchedAt ? `Metrics fetched ${new Date(proof.metricsFetchedAt).toLocaleString()}` : 'Metrics not fetched yet'}
                        </p>
                    </div>

                    {caption && <p className="rounded-xl bg-secondary/40 px-3.5 py-2.5 text-xs leading-relaxed text-foreground/80 line-clamp-4 [overflow-wrap:anywhere]" title={caption}>{caption}</p>}

                    {metrics.length > 0
                        ? <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {[...metrics.map((metric) => ({ label: metric.label, text: exactCount(metric.value), icon: metric.icon })),
                                ...extras.map((item) => ({ label: item.label, text: item.value, icon: item.icon }))].map((item) => (
                                <div key={item.label} className="min-w-0 rounded-xl border border-border/70 px-3 py-2.5">
                                    <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><item.icon className="h-3.5 w-3.5 shrink-0" />{item.label}</dt>
                                    <dd className="mt-0.5 truncate text-base font-semibold tabular-nums">{item.text}</dd>
                                </div>
                            ))}
                        </dl>
                        : <EmptyData title="No metrics yet" message="Meta has not returned metrics for this post yet." />}

                    <div className="rounded-xl border border-border/70 p-3.5">
                        <p className="text-sm font-semibold">Daily performance</p>
                        <p className="mb-2 text-[11px] text-muted-foreground">{days > 1 ? `${days} reporting days for this post` : 'Appears once this post has two reporting days.'}</p>
                        {days > 1 && <TrendChart platform={proof.contentFormat?.startsWith('youtube') ? 'youtube' : 'instagram'} points={points} heightClass="h-44" />}
                    </div>

                    <a href={proof.proofUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90">
                        Open on {proof.contentFormat?.startsWith('youtube') ? 'YouTube' : 'Instagram'} <ExternalLink className="h-4 w-4" />
                    </a>
                </div>
            </div>
        </DialogContent>
    </Dialog>;
}

type CreatorMetric = 'views' | 'reach' | 'totalInteractions';
const CREATOR_METRICS: Array<{ key: CreatorMetric; label: string }> = [
    { key: 'reach', label: 'Reach' },
    { key: 'views', label: 'Views' },
    { key: 'totalInteractions', label: 'Interactions' },
];

export function AnalyticsTab({ campaign, influencers, isReadOnly = false, publicProofs = [] }: AnalyticsTabProps) {
    const summary = useCampaignAnalytics(isReadOnly ? '' : campaign.id);
    const history = useCampaignMetricHistory(isReadOnly ? '' : campaign.id);
    const proofsQuery = useCampaignProofAnalytics(isReadOnly ? '' : campaign.id);
    const refresh = useRefreshProofAnalytics(campaign.id);
    const proofs = useMemo(
        () => isReadOnly ? publicProofs : (proofsQuery.data ?? []),
        [isReadOnly, proofsQuery.data, publicProofs],
    );
    const sections = useMemo(() => isReadOnly
        ? localSections(campaign.contentTypes, proofs)
        : (summary.data?.instagramByFormat ?? localSections(campaign.contentTypes, proofs)),
    [campaign.contentTypes, isReadOnly, proofs, summary.data?.instagramByFormat]);
    const headline = useMemo(() => campaignHeadline(sections), [sections]);

    const [selectedFormat, setSelectedFormat] = useState<string>('all');
    const [creatorMetric, setCreatorMetric] = useState<CreatorMetric>('reach');
    const [trendPlatform, setTrendPlatform] = useState<string>('instagram');
    const [openProof, setOpenProof] = useState<{ proof: ProofReelAnalytics; label: string } | null>(null);
    const [showAllContent, setShowAllContent] = useState(false);

    const autoRefreshAttemptedRef = useRef(false);
    const [isAutoSyncing, setIsAutoSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
        const key = `mutiny_analytics_last_sync_${campaign.id}`;
        const saved = typeof window !== 'undefined' ? sessionStorage.getItem(key) : null;
        return saved ? new Date(Number(saved)) : null;
    });

    useEffect(() => {
        if (isReadOnly || !campaign.id || !proofsQuery.data || autoRefreshAttemptedRef.current || refresh.isPending) {
            return;
        }

        const approvedProofs = proofsQuery.data.filter((p) => p.status === 'approved');
        if (approvedProofs.length === 0) return;

        const now = Date.now();
        const key = `mutiny_analytics_last_sync_${campaign.id}`;
        const saved = sessionStorage.getItem(key);
        const lastSyncMs = saved ? Number(saved) : 0;
        const COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown

        const hasUnfetched = approvedProofs.some((p) => !p.metricsFetchedAt);
        const hasLiveStory = approvedProofs.some((p) => {
            const isStory = p.contentFormat === 'story' || p.contentFormat?.startsWith('story-');
            const notFrozen = p.metricStatus !== 'frozen' && !p.isFinal && p.finalCaptureStatus !== 'captured';
            const notExpired = p.providerExpiresAt ? new Date(p.providerExpiresAt).getTime() > now : false;
            return isStory && notFrozen && notExpired;
        });

        const isStale = (now - lastSyncMs) > COOLDOWN_MS;

        if (isStale || hasUnfetched || hasLiveStory) {
            autoRefreshAttemptedRef.current = true;
            sessionStorage.setItem(key, String(now));
            setIsAutoSyncing(true);

            refresh.mutateAsync()
                .then(() => {
                    const finishedAt = new Date();
                    setLastSyncTime(finishedAt);
                    sessionStorage.setItem(key, String(finishedAt.getTime()));
                    return Promise.all([
                        summary.refetch(),
                        proofsQuery.refetch(),
                        history.refetch(),
                    ]);
                })
                .catch((err) => {
                    console.debug('[AnalyticsTab] Auto-sync pass skipped/deferred:', err);
                })
                .finally(() => {
                    setIsAutoSyncing(false);
                });
        }
    }, [campaign.id, isReadOnly, proofsQuery.data, refresh, summary, history]);

    if (!isReadOnly && (summary.isLoading || proofsQuery.isLoading)) return <AnalyticsSkeleton />;

    const handleRefresh = async () => {
        try {
            const result = await refresh.mutateAsync();
            const refreshed = result.results.filter((item) => item.status === 'refreshed').length;
            const failed = result.results.filter((item) => item.status === 'error').length;
            const absorbed = result.results.filter((item) => item.status === 'in_progress' || item.status === 'recent' || item.status === 'frozen').length;
            await Promise.all([summary.refetch(), proofsQuery.refetch(), history.refetch()]);
            const finishedAt = new Date();
            setLastSyncTime(finishedAt);
            sessionStorage.setItem(`mutiny_analytics_last_sync_${campaign.id}`, String(finishedAt.getTime()));
            toast.success(`Refreshed ${refreshed} proof${refreshed === 1 ? '' : 's'}${absorbed ? `; ${absorbed} already current or frozen` : ''}${failed ? `; ${failed} failed` : ''}.`);
        } catch (error: unknown) {
            const message = typeof error === 'object' && error !== null && 'response' in error
                ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
                : undefined;
            toast.error(message || 'Failed to refresh Instagram analytics.');
        }
    };

    const platformsWithHistory = ['instagram', 'youtube'].filter((platform) => history.data?.series.some((point) => point.platform === platform));
    const trendDays = new Set((history.data?.series ?? []).map((point) => point.date)).size;
    const showTrend = trendDays > 1 && platformsWithHistory.length > 0;
    const trendPlatformShown = platformsWithHistory.includes(trendPlatform) ? trendPlatform : platformsWithHistory[0];
    const trendPoints = (history.data?.series ?? []).filter((point) => point.platform === trendPlatformShown);
    // The same daily history, one array per metric, for the hero and stat-card sparklines. A format
    // filter has no per-format daily history, so the lines are hidden while one is selected.
    const dailyOf = (read: (point: CampaignMetricHistoryPoint) => number | null) =>
        selectedFormat !== 'all' || !showTrend ? [] : [...trendPoints].sort((a, b) => a.date.localeCompare(b.date)).map(read).filter((v): v is number => v != null);
    const trendSeries = {
        reach: dailyOf((point) => point.reach),
        views: dailyOf((point) => point.views),
        interactions: dailyOf((point) => point.totalInteractions),
        likes: dailyOf((point) => point.likes),
        shares: dailyOf((point) => point.shares),
        saved: dailyOf((point) => point.saved),
    };

    // Everything below follows the format filter, so one click re-scopes the whole dashboard.
    const activeSection = sections.find((section) => section.format === selectedFormat) ?? null;
    const scope = activeSection ? campaignHeadline([activeSection]) : headline;
    const scopeStates = activeSection?.metricAvailability;
    const scopeLabel = activeSection?.label ?? 'All formats';
    const verifiedProofs = proofs
        .filter((proof) => proof.status === 'approved' && proof.metricSource === 'meta_graph')
        .filter((proof) => !activeSection || proofInstagramAnalyticsFormat(proof) === activeSection.format)
        .sort((a, b) => ((b.scrapedReach ?? -1) - (a.scrapedReach ?? -1)) || ((b.scrapedViews ?? -1) - (a.scrapedViews ?? -1)));

    const creatorTotals = new Map<string, { label: string; views: number | null; reach: number | null; totalInteractions: number | null }>();
    const addPresent = (current: number | null, next: number | null | undefined) => (next == null ? current : (current ?? 0) + next);
    verifiedProofs.forEach((proof) => {
        const key = proof.influencerHandle || proof.influencerName;
        const entry = creatorTotals.get(key) ?? { label: proof.influencerName || `@${proof.influencerHandle}`, views: null, reach: null, totalInteractions: null };
        entry.views = addPresent(entry.views, proof.scrapedViews);
        entry.reach = addPresent(entry.reach, proof.scrapedReach);
        entry.totalInteractions = addPresent(entry.totalInteractions, proof.scrapedTotalInteractions);
        creatorTotals.set(key, entry);
    });
    const creatorBars: ChartSegment[] = [...creatorTotals.entries()]
        .map(([key, creator]) => ({ key, label: creator.label, value: creator[creatorMetric] }))
        .filter((item): item is ChartSegment => item.value != null);

    const reelProofs = verifiedProofs.filter((proof) => proofInstagramAnalyticsFormat(proof) === 'reel');
    const watchTime = activeSection ? activeSection.totalWatchTime : sumPresent(reelProofs, (proof) => platformNumber(proof, 'ig_reels_video_view_total_time'));
    const watchSupported = !activeSection || activeSection.metricAvailability.totalWatchTime !== 'not_supported';
    const replies = scope.totals.totalReplies ?? null;
    const follows = scope.totals.totalFollows ?? null;
    const breakdownFacts = [
        scope.views != null && scope.reach != null && scope.reach > 0 ? { label: 'Views / account', value: (scope.views / scope.reach).toFixed(1), icon: Eye } : null,
        scope.reach != null && scope.proofCount > 0 ? { label: 'Avg reach / post', value: compactCount(scope.reach / scope.proofCount), icon: Users } : null,
        replies != null ? { label: 'Replies', value: compactCount(replies), icon: Reply } : null,
        follows != null ? { label: 'Follows', value: compactCount(follows), icon: UserPlus } : null,
    ].filter((fact): fact is { label: string; value: string; icon: typeof Eye } => fact != null);

    // Actual cost efficiency: full agreed fees of creators whose advance is paid, against delivered
    // results. Campaign-wide — creator payments aren't split by format — so hidden when a format is
    // selected, and never shown on the public review link.
    const paidSpend = influencers
        .filter((ci) => ci.paymentStatus === 'first_paid' || ci.paymentStatus === 'pending_final' || ci.paymentStatus === 'completed')
        .reduce((sum, ci) => sum + (Number(ci.agreedBudget ?? ci.quotedPrice ?? 0) || 0), 0);
    const costPer = (amount: number | null | undefined, per = 1) => (amount && amount > 0 && paidSpend > 0 ? (paidSpend / amount) * per : null);
    const rupees = (value: number) => `₹${value >= 100 ? Math.round(value).toLocaleString('en-IN') : value.toFixed(value >= 10 ? 1 : 2)}`;
    const costFacts = !isReadOnly && !activeSection && paidSpend > 0 ? [
        { label: 'Cost per view', value: costPer(headline.views), icon: Eye },
        { label: 'CPM (reach)', value: costPer(headline.reach, 1000), icon: Users },
        { label: 'Cost per engagement', value: costPer(headline.interactions), icon: Activity },
        { label: 'Cost per share', value: costPer(headline.totals.totalShares), icon: Share2 },
    ].filter((fact): fact is { label: string; value: number; icon: typeof Eye } => fact.value != null) : [];

    const peakReach = Math.max(1, ...sections.map((section) => section.totalReach ?? 0));
    const shownContent = showAllContent ? verifiedProofs : verifiedProofs.slice(0, 12);
    const syncMinutes = lastSyncTime ? Math.floor((Date.now() - lastSyncTime.getTime()) / 60000) : null;
    const isSyncing = isAutoSyncing || refresh.isPending;
    const labelFor = (proof: ProofReelAnalytics) => {
        const format = proofInstagramAnalyticsFormat(proof);
        return format ? instagramContentFormatLabel(format) : (proof.contentFormat || 'Post');
    };

    const formatOptions = [
        { key: 'all', label: `All · ${headline.proofCount}` },
        ...sections.map((section) => ({ key: section.format as string, label: `${section.label} · ${section.proofCount}` })),
    ];

    return (
        <div className="space-y-4">
            <UnverifiedNotice proofs={proofs} />

            {/* Hero: the campaign's headline result on a dark stage — reach as the big figure with its trend,
                engagement as a ring, the supporting counts beside them, scope and sync along the top. */}
            <section className="relative isolate overflow-hidden rounded-3xl p-5 text-white shadow-float sm:p-6">
                <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black" />
                <span aria-hidden className="pointer-events-none absolute -right-20 -top-28 -z-10 h-80 w-80 rounded-full bg-brand/30 blur-[90px]" />
                <span aria-hidden className="pointer-events-none absolute -bottom-32 left-1/4 -z-10 h-64 w-[60%] rounded-[100%] bg-brand/10 blur-3xl" />
                <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-3xl ring-1 ring-inset ring-white/10" />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="-mx-1 overflow-x-auto px-1 scrollbar-hide">
                        <div className="inline-flex shrink-0 rounded-full bg-white/10 p-1 ring-1 ring-white/10" role="tablist" aria-label="Filter analytics by format">
                            {formatOptions.map((option) => <button
                                key={option.key}
                                type="button"
                                role="tab"
                                aria-selected={selectedFormat === option.key}
                                onClick={() => setSelectedFormat(option.key)}
                                className={cn('whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-200', selectedFormat === option.key ? 'bg-brand text-black' : 'text-white/60 hover:text-white')}
                            >{option.label}</button>)}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-white/55" title={lastSyncTime ? `Last synced ${lastSyncTime.toLocaleString()}` : undefined}>
                            {isSyncing
                                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Syncing with Meta…</>
                                : <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{syncMinutes == null ? 'Meta verified metrics' : `Synced ${syncMinutes < 1 ? 'just now' : `${syncMinutes}m ago`}`}</>}
                        </span>
                        {!isReadOnly && <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isSyncing}
                            className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold ring-1 ring-white/15 transition-colors hover:bg-white hover:text-black disabled:opacity-50"
                        >
                            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                            Refresh
                        </button>}
                    </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)] lg:items-end">
                    {/* Reach, the headline, with its trend */}
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                            <Sparkles className="h-3.5 w-3.5 text-brand" />
                            Total reach · {scopeLabel}
                        </p>
                        <p className="mt-2 font-display text-5xl font-semibold leading-none tracking-tight tabular-nums sm:text-6xl" title={scope.reach != null ? exactCount(scope.reach) : undefined}>
                            {scope.reach != null ? compactCount(scope.reach) : '—'}
                        </p>
                        <p className="mt-2 text-xs text-white/55">
                            Unique accounts that saw {scope.proofCount === 1 ? 'the post' : `the ${scope.proofCount} posts`}
                            {creatorTotals.size > 0 && <> from {creatorTotals.size} creator{creatorTotals.size === 1 ? '' : 's'}</>}
                        </p>
                        {trendSeries.reach.length > 1 && (
                            <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="mt-4 h-14 w-full max-w-md overflow-visible" role="img" aria-label="Reach over the last reporting days">
                                <defs>
                                    <linearGradient id="hero-reach-wash" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#facb03" stopOpacity={0.45} />
                                        <stop offset="100%" stopColor="#facb03" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                {(() => {
                                    const values = trendSeries.reach;
                                    const max = Math.max(...values);
                                    const min = Math.min(...values);
                                    const span = max - min || 1;
                                    const px = (i: number) => (i / (values.length - 1)) * 300;
                                    const py = (v: number) => 56 - ((v - min) / span) * 50;
                                    const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
                                    return <>
                                        <path d={`${line} L300 60 L0 60 Z`} fill="url(#hero-reach-wash)" />
                                        <path d={line} fill="none" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand" />
                                        <circle cx={px(values.length - 1)} cy={py(values[values.length - 1])} r={4} vectorEffect="non-scaling-stroke" className="fill-black stroke-brand" strokeWidth={2.5} />
                                    </>;
                                })()}
                            </svg>
                        )}
                    </div>

                    {/* Engagement rate as a ring */}
                    <div className="flex items-center gap-4 lg:flex-col lg:items-center lg:gap-2">
                        {(() => {
                            const rate = scope.engagementRate;
                            // A 10% engagement rate fills the ring; most creators sit between 2% and 8%.
                            const filled = rate == null ? 0 : Math.min(1, rate / 10);
                            const r = 46;
                            const c = 2 * Math.PI * r;
                            return <span className="relative grid h-32 w-32 place-items-center">
                                <svg viewBox="0 0 110 110" className="absolute inset-0 -rotate-90" aria-hidden>
                                    <circle cx="55" cy="55" r={r} fill="none" strokeWidth="9" className="stroke-white/10" />
                                    <circle cx="55" cy="55" r={r} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - filled)} className="stroke-brand transition-[stroke-dashoffset] duration-1000 ease-out" />
                                </svg>
                                <span className="text-center">
                                    <span className="block font-display text-2xl font-semibold tabular-nums">{rate != null ? `${rate.toFixed(2)}%` : '—'}</span>
                                    <span className="block text-[10px] uppercase tracking-[0.1em] text-white/50">Engagement</span>
                                </span>
                            </span>;
                        })()}
                        <p className="max-w-[10rem] text-[11px] text-white/45 lg:text-center">Interactions ÷ reach</p>
                    </div>

                    {/* Supporting counts */}
                    <dl className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Views', value: scope.views, icon: Eye },
                            { label: 'Interactions', value: scope.interactions, icon: Activity },
                            { label: 'Posts tracked', value: scope.proofCount, icon: Layers },
                            { label: 'Creators', value: creatorTotals.size, icon: Users },
                        ].map((fact) => <div key={fact.label} className="min-w-0 rounded-2xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10">
                            <dt className="flex items-center gap-1.5 text-[11px] text-white/55"><fact.icon className="h-3 w-3 shrink-0" />{fact.label}</dt>
                            <dd className="mt-1 truncate font-display text-xl font-semibold tabular-nums">{fact.value != null ? compactCount(fact.value) : '—'}</dd>
                        </div>)}
                    </dl>
                </div>
            </section>

            {/* Metric cards, each with its own trend when the daily history has one */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <KpiCell label="Reach" value={scope.reach} state={scopeStates?.reach} icon={Users} hint="Unique accounts reached" trend={trendSeries.reach} />
                <KpiCell label="Views" value={scope.views} state={scopeStates?.views} icon={Eye} hint="Times content was displayed" trend={trendSeries.views} />
                <KpiCell label="Interactions" value={scope.interactions} state={scopeStates?.totalInteractions} icon={Activity} hint="Likes, comments, shares, saves" trend={trendSeries.interactions} />
                <KpiCell label="Likes" value={scope.totals.totalLikes} state={scopeStates?.likes} icon={Heart} hint="Hearts on the posts" trend={trendSeries.likes} />
                <KpiCell label="Shares" value={scope.totals.totalShares} state={scopeStates?.shares} icon={Share2} hint="Sent on to others" trend={trendSeries.shares} />
                {watchSupported
                    ? <KpiCell label="Watch time" value={watchTime} state={activeSection?.metricAvailability.totalWatchTime} kind="duration" icon={Clock} hint={reelProofs.length ? `Across ${reelProofs.length} reel${reelProofs.length === 1 ? '' : 's'}` : 'Reels only'} />
                    : <KpiCell label="Saves" value={scope.totals.totalSaved} state={scopeStates?.saved} icon={Bookmark} hint="Saved for later" trend={trendSeries.saved} />}
            </div>

            {activeSection?.format.startsWith('story-') && (
                <StoryFormatLifecycleBanner
                    formatProofs={proofs.filter((proof) => proof.status === 'approved' && proofInstagramAnalyticsFormat(proof) === activeSection.format)}
                    label={activeSection.label}
                />
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {!isReadOnly && <Panel
                    className="lg:col-span-8"
                    icon={TrendingUp}
                    title="Performance over time"
                    caption={showTrend
                        ? `${trendPlatformShown === 'youtube' ? 'YouTube' : 'Instagram'} · ${new Set(trendPoints.map((point) => point.date)).size} reporting days · all formats`
                        : 'Daily snapshots of every approved post'}
                    aside={platformsWithHistory.length > 1 ? <Segmented
                        options={platformsWithHistory.map((item) => ({ key: item, label: item === 'youtube' ? 'YouTube' : 'Instagram' }))}
                        value={trendPlatformShown}
                        onChange={setTrendPlatform}
                        label="Trend platform"
                    /> : undefined}
                >
                    {history.isLoading
                        ? <Skeleton className="h-56 rounded-xl lg:h-64" />
                        : showTrend
                            ? <TrendChart platform={trendPlatformShown} points={trendPoints} heightClass="h-56 lg:h-64" />
                            : <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 px-6 py-10 text-center">
                                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                                    {trendDays === 0
                                        ? 'Approved proofs are snapshotted daily. The trend appears after two reporting days.'
                                        : `${trendDays} reporting day recorded. The trend appears after tomorrow's snapshot.`}
                                </p>
                            </div>}
                </Panel>}

                <Panel className={isReadOnly ? 'lg:col-span-4 lg:order-last' : 'lg:col-span-4'} icon={PieChart} title="Engagement breakdown" caption={`How audiences interacted · ${scopeLabel}`}>
                    <EngagementBreakdown mix={scope.mix} facts={breakdownFacts} />
                    {costFacts.length > 0 && <div className="mt-4 border-t border-dashed border-border pt-3">
                        <p className="mb-2 flex items-baseline justify-between gap-2 text-xs font-semibold">
                            Cost efficiency
                            <span className="text-[10px] font-normal text-muted-foreground">on ₹{paidSpend.toLocaleString('en-IN')} in creator fees</span>
                        </p>
                        <dl className="grid grid-cols-2 gap-2">
                            {costFacts.map((fact) => <div key={fact.label} className="min-w-0 rounded-2xl border border-brand/30 bg-brand/10 px-3 py-2.5">
                                <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><fact.icon className="h-3 w-3 shrink-0" />{fact.label}</dt>
                                <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{rupees(fact.value)}</dd>
                            </div>)}
                        </dl>
                    </div>}
                </Panel>

                <Panel
                    className={isReadOnly ? 'lg:col-span-8' : 'lg:col-span-7'}
                    icon={Grid3x3}
                    title="Deliverables by format"
                    caption="Select a row to scope the dashboard"
                >
                    {sections.length === 0
                        ? <EmptyData title="No formats configured" message="No Instagram deliverable formats are configured for this campaign." />
                        : <div className="-mx-4 overflow-x-auto">
                            <table className="w-full min-w-[520px] text-xs">
                                <thead>
                                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                                        <th className="px-4 pb-2 text-left font-medium">Format</th>
                                        <th className="px-2 pb-2 text-right font-medium">Posts</th>
                                        <th className="px-2 pb-2 text-right font-medium">Reach</th>
                                        <th className="px-2 pb-2 text-right font-medium">Views</th>
                                        <th className="px-2 pb-2 text-right font-medium">Interactions</th>
                                        <th className="px-4 pb-2 text-right font-medium">Eng. rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sections.map((section) => {
                                        const selected = selectedFormat === section.format;
                                        const liveStories = section.format.startsWith('story-') && proofs.some((proof) => proof.status === 'approved'
                                            && proofInstagramAnalyticsFormat(proof) === section.format
                                            && proof.providerExpiresAt && new Date(proof.providerExpiresAt).getTime() > Date.now()
                                            && proof.metricStatus !== 'frozen' && !proof.isFinal && proof.finalCaptureStatus !== 'captured');
                                        return <tr
                                            key={section.format}
                                            onClick={() => setSelectedFormat(selected ? 'all' : section.format)}
                                            className={cn(
                                                'cursor-pointer border-b border-border/60 transition-colors last:border-0',
                                                selected ? 'bg-brand/10 shadow-[inset_3px_0_0_theme(colors.brand.DEFAULT)]' : 'hover:bg-secondary/40',
                                            )}
                                        >
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-foreground">{section.label}</span>
                                                    {liveStories && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                                        Live
                                                    </span>}
                                                </div>
                                                <div className="mt-1.5 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-secondary">
                                                    <div className="h-full rounded-full bg-brand" style={{ width: `${((section.totalReach ?? 0) / peakReach) * 100}%` }} />
                                                </div>
                                            </td>
                                            <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{section.proofCount}</td>
                                            <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{section.totalReach != null ? compactCount(section.totalReach) : '—'}</td>
                                            <td className="px-2 py-2.5 text-right tabular-nums">{section.totalViews != null ? compactCount(section.totalViews) : '—'}</td>
                                            <td className="px-2 py-2.5 text-right tabular-nums">{section.totalEngagements != null ? compactCount(section.totalEngagements) : '—'}</td>
                                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{section.engagementRate != null ? `${section.engagementRate.toFixed(1)}%` : '—'}</td>
                                        </tr>;
                                    })}
                                </tbody>
                            </table>
                        </div>}
                </Panel>

                {!isReadOnly && <Panel
                    className="lg:col-span-5"
                    icon={Trophy}
                    title="Top creators"
                    caption={scopeLabel}
                    aside={creatorTotals.size > 0 ? <Segmented<CreatorMetric> options={CREATOR_METRICS} value={creatorMetric} onChange={setCreatorMetric} label="Compare creators by" /> : undefined}
                >
                    {creatorBars.length > 0
                        ? <RankedBars items={creatorBars} valueMode="both" formatValue={compactCount} max={6} />
                        : <p className="py-2 text-xs text-muted-foreground">No creator has verified metrics yet.</p>}
                </Panel>}
            </div>

            {/* Content gallery — every verified post, best reach first */}
            <Panel
                icon={BarChart3}
                title="Content"
                caption={`${verifiedProofs.length} verified post${verifiedProofs.length === 1 ? '' : 's'} · ${scopeLabel} · ranked by reach`}
                aside={verifiedProofs.length > 12 ? <button type="button" className="h-8 rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:border-foreground" onClick={() => setShowAllContent((value) => !value)}>
                    {showAllContent ? 'Show less' : `Show all ${verifiedProofs.length}`}
                </button> : undefined}
            >
                {verifiedProofs.length === 0
                    ? <EmptyData title="No verified posts yet" message="Approved proofs appear here once Meta returns their metrics." />
                    : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                        {shownContent.map((proof, index) => {
                            const label = labelFor(proof);
                            const isStory = proofInstagramAnalyticsFormat(proof)?.startsWith('story-');
                            return <button
                                key={proof.proofId}
                                type="button"
                                onClick={() => setOpenProof({ proof, label })}
                                className="group min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-float"
                            >
                                <div className="relative">
                                    <MediaThumb src={proof.thumbnailUrl} alt={`${label} by ${proof.influencerName || 'creator'}`} className="aspect-[4/5] w-full" />
                                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">{label}</span>
                                    {index < 3 && !showAllContent && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-black shadow-sm">{index + 1}</span>}
                                </div>
                                <div className="space-y-1 p-2.5">
                                    <p className="truncate text-xs font-semibold">{proof.influencerName || `@${proof.influencerHandle}`}</p>
                                    <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
                                        <span><strong className="font-semibold text-foreground">{proof.scrapedReach != null ? compactCount(proof.scrapedReach) : '—'}</strong> reach</span>
                                        {proof.scrapedEngagementRate && Number.isFinite(Number(proof.scrapedEngagementRate)) && <span>{Number(proof.scrapedEngagementRate).toFixed(1)}% ER</span>}
                                    </div>
                                    {isStory && <StoryStatusBadge proof={proof} className="max-w-full truncate" />}
                                </div>
                            </button>;
                        })}
                    </div>}
            </Panel>

            {openProof && (
                <ProofDetailDialog
                    proof={openProof.proof}
                    formatLabel={openProof.label}
                    points={(history.data?.contentPoints ?? [])
                        .filter((point) => openProof.proof.metricContentId && point.contentId === openProof.proof.metricContentId)
                        .sort((a, b) => a.date.localeCompare(b.date))}
                    onClose={() => setOpenProof(null)}
                />
            )}
        </div>
    );
}
