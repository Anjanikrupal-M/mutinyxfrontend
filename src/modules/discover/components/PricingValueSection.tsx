import { useMemo, useState } from 'react';
import { Activity, Eye, IndianRupee, Info, MousePointerClick, Tag, Target, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { InstagramInsightsPayload } from '../influencer-display';

type ContentItem = NonNullable<InstagramInsightsPayload['content']>[number];

/**
 * Rate-card keys (backend rateCardSchema) in display order, with the Instagram content
 * formats whose recent performance prices them. YouTube has no synced data on Mutiny, so its
 * rates show without value metrics.
 */
const RATE_FORMATS: Array<{ key: string; label: string; contentFormats: string[]; one: string; noun: string }> = [
    { key: 'instagram_reel', label: 'Reel', contentFormats: ['reel'], one: 'reel', noun: 'reels' },
    { key: 'instagram_post', label: 'Feed post', contentFormats: ['feed-image', 'feed-video'], one: 'feed post', noun: 'feed posts' },
    { key: 'instagram_carousel', label: 'Carousel', contentFormats: ['carousel'], one: 'carousel', noun: 'carousels' },
    { key: 'instagram_story', label: 'Story', contentFormats: ['story'], one: 'story', noun: 'stories' },
    { key: 'youtube_short', label: 'YouTube Short', contentFormats: [], one: 'Short', noun: 'Shorts' },
    { key: 'youtube_video', label: 'YouTube video', contentFormats: [], one: 'video', noun: 'videos' },
    { key: 'youtube_dedicated_video', label: 'YouTube dedicated', contentFormats: [], one: 'dedicated video', noun: 'dedicated videos' },
];

const compact = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
    return Math.round(value).toLocaleString('en-IN');
};

/** Rupees with precision that suits the size: ₹0.85 per engagement, ₹645 CPM, ₹8,000 rate. */
const rupees = (value: number) => {
    if (value >= 100) return `₹${Math.round(value).toLocaleString('en-IN')}`;
    if (value >= 10) return `₹${value.toFixed(1)}`;
    return `₹${value.toFixed(2)}`;
};

const average = (values: Array<number | null | undefined>) => {
    const present = values.filter((v): v is number => v != null && Number.isFinite(v));
    return present.length > 0 ? present.reduce((sum, v) => sum + v, 0) / present.length : null;
};

const interactionsOf = (item: ContentItem) => {
    const m = item.metrics;
    if (!m) return null;
    if (m.totalInteractions != null) return m.totalInteractions;
    const parts = [m.likes, m.comments, m.shares, m.saves].filter((v): v is number => v != null);
    return parts.length > 0 ? parts.reduce((sum, v) => sum + v, 0) : null;
};

interface FormatValue {
    key: string;
    label: string;
    one: string;
    noun: string;
    rate: number | null;
    sampleSize: number;
    avgViews: number | null;
    avgReach: number | null;
    avgInteractions: number | null;
}

function buildFormatValues(rateCard: Record<string, number>, content: ContentItem[]): FormatValue[] {
    return RATE_FORMATS.map((format) => {
        const items = content.filter((item) => format.contentFormats.includes(item.format) && item.metrics);
        const rate = Number(rateCard[format.key]) > 0 ? Number(rateCard[format.key]) : null;
        return {
            key: format.key,
            label: format.label,
            one: format.one,
            noun: format.noun,
            rate,
            sampleSize: items.length,
            avgViews: average(items.map((item) => item.metrics?.views)),
            avgReach: average(items.map((item) => item.metrics?.reach)),
            avgInteractions: average(items.map(interactionsOf)),
        };
    })
        // A format earns a tab when there is a price for it or performance to show.
        .filter((format) => format.rate != null || format.sampleSize > 0);
}

function ValueTile({ icon: Icon, label, value, hint, emphasis }: {
    icon: typeof Eye;
    label: string;
    value: string | null;
    hint: string;
    emphasis?: boolean;
}) {
    return (
        <div className={cn('min-w-0 rounded-2xl p-3.5', emphasis ? 'bg-foreground text-background' : 'bg-secondary/40')}>
            <p className={cn('flex items-center gap-1.5 text-xs font-medium', emphasis ? 'text-background/70' : 'text-muted-foreground')}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
            </p>
            <p className={cn(
                'mt-1.5 font-display font-semibold tabular-nums tracking-tight leading-none truncate',
                value == null ? 'text-lg text-muted-foreground/50' : 'text-[22px]',
            )}>
                {value ?? '—'}
            </p>
            <p className={cn('mt-1 text-[11px] leading-snug line-clamp-2', emphasis ? 'text-background/70' : 'text-muted-foreground')}>{hint}</p>
        </div>
    );
}

/**
 * The creator's price per deliverable beside what that price buys — CPM, cost per 1K reach,
 * cost per engagement — worked out from their recent Instagram content of the same format.
 * Format tabs follow the Analytics page; every tab fills one full-width row of tiles.
 */
export function PricingValueSection({ rateCard, insights, className }: {
    rateCard?: Record<string, number> | null;
    insights?: InstagramInsightsPayload | null;
    className?: string;
}) {
    const content = insights?.connected ? insights.content ?? [] : [];
    const formats = useMemo(() => buildFormatValues(rateCard ?? {}, content), [rateCard, content]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    if (formats.length === 0) return null;

    const active = formats.find((f) => f.key === selectedKey) ?? formats[0];
    const isYouTube = active.key.startsWith('youtube');
    const engagementRate = active.avgInteractions != null && active.avgReach
        ? (active.avgInteractions / active.avgReach) * 100
        : null;
    const cpm = active.rate != null && active.avgViews ? (active.rate / active.avgViews) * 1000 : null;
    const costPerReach = active.rate != null && active.avgReach ? (active.rate / active.avgReach) * 1000 : null;
    const costPerEngagement = active.rate != null && active.avgInteractions ? active.rate / active.avgInteractions : null;
    const hasRate = active.rate != null;
    const hasData = active.sampleSize > 0;
    const anyRate = formats.some((f) => f.rate != null);
    const showEngagement = engagementRate != null && engagementRate <= 100;

    // Performance tiles, shared by the priced and unpriced layouts.
    const performanceTiles = (
        <>
            <ValueTile icon={Eye} label="Avg views" value={active.avgViews != null ? compact(active.avgViews) : null} hint={`Per ${active.one}`} />
            <ValueTile icon={Users} label="Avg reach" value={active.avgReach != null ? compact(active.avgReach) : null} hint="Accounts reached each" />
            <ValueTile icon={MousePointerClick} label="Avg interactions" value={active.avgInteractions != null ? compact(active.avgInteractions) : null} hint="Likes, comments, shares, saves" />
            {/* Meta can report more interactions than accounts reached; a rate over 100%
                means nothing to a brand, so it is withheld like on the content cards. */}
            <ValueTile icon={Activity} label="Engagement by reach" value={showEngagement ? `${engagementRate!.toFixed(2)}%` : null} hint="Interactions per account reached" />
        </>
    );

    return (
        <section className={cn('rounded-[28px] border border-border bg-card p-4 shadow-card sm:p-5 space-y-4', className)}>
            <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-brand">
                    <IndianRupee className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold tracking-tight">Pricing &amp; value</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {anyRate
                            ? 'The creator’s rates, and what each one buys based on their recent content'
                            : 'How each format performs — this creator hasn’t published a rate card yet'}
                    </p>
                </div>
            </div>

            {/* Formats — one tray on its own row that wraps, so no format is ever cut off. The
                black pill slides to the selected format; its price turns yellow. */}
            <div className="flex flex-wrap gap-1 rounded-2xl bg-secondary/60 p-1" role="tablist" aria-label="Deliverable formats">
                {formats.map((format) => {
                    const selected = format.key === active.key;
                    return (
                        <button
                            key={format.key}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setSelectedKey(format.key)}
                            className={cn(
                                'relative flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-xs font-semibold transition-colors duration-200 active:scale-95',
                                selected ? 'text-background' : 'text-foreground/70 hover:bg-card hover:text-foreground',
                            )}
                        >
                            {selected && (
                                <motion.span
                                    layoutId="pricing-format-pill"
                                    transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                                    className="absolute inset-0 rounded-xl bg-foreground shadow-sm"
                                />
                            )}
                            <span className="relative">{format.label}</span>
                            {format.rate != null && (
                                <span className={cn('relative tabular-nums font-medium', selected ? 'text-brand' : 'text-muted-foreground')}>
                                    {rupees(format.rate)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Three layouts, each filling full rows — no tile is ever rendered just to say
                "missing": priced + data (8 tiles), data but no price (notice + 4), price but
                no data (rate + explanation). */}
            {hasRate && hasData ? (
                <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 gap-3">
                    <ValueTile icon={Tag} label={`${active.label} rate`} value={rupees(active.rate!)} hint="Per deliverable, from rate card" emphasis />
                    {performanceTiles}
                    <ValueTile icon={IndianRupee} label="Est. CPM" value={cpm != null ? rupees(cpm) : null} hint="Cost per 1,000 views" />
                    <ValueTile icon={Target} label="Cost per 1K reach" value={costPerReach != null ? rupees(costPerReach) : null} hint="Cost per 1,000 accounts" />
                    <ValueTile icon={Activity} label="Cost per engagement" value={costPerEngagement != null ? rupees(costPerEngagement) : null} hint="Rate ÷ avg interactions" />
                </div>
            ) : hasData ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="col-span-2 md:col-span-1 min-w-0 rounded-2xl border border-dashed border-border p-3.5 flex flex-col justify-center">
                        <p className="flex items-center gap-1.5 text-xs font-semibold">
                            <Tag className="w-3.5 h-3.5 shrink-0" />
                            No {active.one} rate yet
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                            Use Connect to ask for a quote. CPM and cost per engagement appear once a rate is set.
                        </p>
                    </div>
                    {performanceTiles}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-3">
                    <ValueTile icon={Tag} label={`${active.label} rate`} value={rupees(active.rate!)} hint="Per deliverable, from rate card" emphasis />
                    <div className="min-w-0 rounded-2xl bg-secondary/40 p-3.5 flex items-center gap-3">
                        <Info className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {isYouTube
                                ? 'Mutiny doesn’t sync YouTube performance yet, so views, reach and cost estimates aren’t available for this format.'
                                : `None of the creator’s recent ${active.noun} have Instagram insights yet, so views, reach and cost estimates aren’t available.`}
                        </p>
                    </div>
                </div>
            )}

            {hasData && (
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                    Averages from {active.sampleSize} of the creator’s recent {active.sampleSize === 1 ? active.one : active.noun} on Instagram.
                    {hasRate && ' Costs are estimates — the rate divided by those averages — and actual campaign results can differ.'}
                </p>
            )}
        </section>
    );
}
