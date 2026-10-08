import { useState } from 'react';
import { Briefcase, ChevronDown, ExternalLink, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import { MediaThumb } from '@/shared/components/MediaThumb';
import type { PreviousWorkItem } from '../hooks/useInfluencers';

// Two full rows at the widest (6-up) grid.
const INITIAL_VISIBLE = 12;

const compact = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
    return value.toLocaleString('en-IN');
};

const formatMonth = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

const formatLabel = (post: PreviousWorkItem['posts'][number]) => {
    const raw = post.contentFormat ?? post.contentType;
    if (!raw) return 'Post';
    return raw.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const sumOf = (items: PreviousWorkItem[], key: 'views' | 'likes' | 'comments' | 'reach') => {
    const values = items.map((item) => item.results[key]).filter((value): value is number => value != null);
    return values.length > 0 ? values.reduce((total, value) => total + value, 0) : null;
};

function Stars({ rating }: { rating: number }) {
    return (
        <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn('w-3 h-3', n <= rating ? 'fill-[#fedc03] text-[#fedc03]' : 'text-border')} />
            ))}
        </span>
    );
}

const MAX_EXTRA_THUMBS = 3;

/**
 * Same card language as the Instagram panel's Top reels: the live post leads as a 4:5
 * thumbnail with the brand on it, then the campaign, its results and the brand's review.
 */
function WorkCard({ item }: { item: PreviousWorkItem }) {
    const results = [
        { label: 'Views', value: item.results.views },
        { label: 'Reach', value: item.results.reach },
        { label: 'Likes', value: item.results.likes },
        { label: 'Comments', value: item.results.comments },
        { label: 'Shares', value: item.results.shares },
        { label: 'Saves', value: item.results.saves },
    ].filter((metric): metric is { label: string; value: number } => metric.value != null);
    const completedOn = formatMonth(item.completedAt);
    const [lead, ...otherPosts] = item.posts;
    const extraThumbs = otherPosts.slice(0, MAX_EXTRA_THUMBS);
    const hiddenPosts = otherPosts.length - extraThumbs.length;
    const cover = lead?.thumbnailUrl ?? item.campaignThumbnailUrl;

    const media = (
        <>
            <MediaThumb
                src={cover}
                alt={lead ? `${formatLabel(lead)} for ${item.brand.name}` : item.campaignName}
                className="aspect-[4/5]"
                imageClassName="transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent" />
            <span className="absolute left-2 top-2 right-10 inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/90 py-0.5 pl-0.5 pr-2 text-[10px] font-semibold text-black backdrop-blur-md">
                <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-card">
                    <ApiImage src={item.brand.logoUrl} alt={item.brand.name} className="h-full w-full object-cover" fallbackText={item.brand.name.charAt(0).toUpperCase()} placeholderClassName="text-[9px]" />
                </span>
                <span className="truncate">{item.brand.name}</span>
            </span>
            {lead && (
                <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-black backdrop-blur-md" aria-hidden>
                    <ExternalLink className="w-3.5 h-3.5" />
                </span>
            )}
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                {lead ? formatLabel(lead) : 'No live post'}
                {item.posts.length > 1 && ` · ${item.posts.length} posts`}
            </span>
        </>
    );

    return (
        <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl bg-secondary/40">
            {lead ? (
                <a href={lead.permalink} target="_blank" rel="noopener noreferrer" className="relative block" title={`Open ${formatLabel(lead).toLowerCase()} on ${lead.platform ?? 'Instagram'}`}>
                    {media}
                </a>
            ) : (
                <div className="relative">{media}</div>
            )}

            <div className="flex flex-1 flex-col gap-2 p-2.5 min-w-0">
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-tight truncate" title={item.campaignName}>{item.campaignName}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                        <span className="truncate">{[item.brand.industry, completedOn && `Completed ${completedOn}`].filter(Boolean).join(' · ') || item.brand.name}</span>
                    </p>
                </div>

                {results.length > 0 ? (
                    <dl className="grid grid-cols-3 gap-y-2 rounded-lg bg-card px-0.5 py-2">
                        {results.map((metric) => (
                            <div key={metric.label} className="min-w-0 text-center">
                                <dt className="truncate text-[10px] text-muted-foreground">{metric.label}</dt>
                                <dd className="truncate text-[13px] font-semibold tabular-nums leading-tight">{compact(metric.value)}</dd>
                            </div>
                        ))}
                    </dl>
                ) : (
                    <p className="rounded-lg bg-card px-2.5 py-2 text-[11px] text-muted-foreground">
                        {item.posts.length > 0 ? 'Results are still being collected.' : 'No live post was recorded.'}
                    </p>
                )}

                {extraThumbs.length > 0 && (
                    <div className="flex items-center gap-1.5 min-w-0">
                        {extraThumbs.map((post) => (
                            <a
                                key={post.id}
                                href={post.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative w-8 h-10 shrink-0 rounded-md overflow-hidden bg-card ring-1 ring-black/5"
                                title={`Open ${formatLabel(post).toLowerCase()} on ${post.platform ?? 'Instagram'}`}
                            >
                                <ApiImage src={post.thumbnailUrl} alt={formatLabel(post)} className="w-full h-full object-cover" fallbackText={formatLabel(post).charAt(0)} placeholderClassName="text-[10px]" />
                            </a>
                        ))}
                        {hiddenPosts > 0 && <span className="text-[11px] font-medium text-muted-foreground">+{hiddenPosts}</span>}
                    </div>
                )}

                {(item.rating != null || item.review) && (
                    <div className="mt-auto space-y-1 border-t border-border/60 pt-2">
                        {item.rating != null && <Stars rating={item.rating} />}
                        {item.review && (
                            <p className="text-[11px] text-foreground/75 leading-snug line-clamp-2 break-words" title={item.review}>“{item.review}”</p>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}

export function PreviousWorkSection({ items, totalCampaigns, experience }: {
    items: PreviousWorkItem[];
    /** Full completed-campaign count; `items` is capped by the API. */
    totalCampaigns: number;
    experience?: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
    const totals = [
        { label: 'Total views', value: sumOf(items, 'views') },
        { label: 'Total likes', value: sumOf(items, 'likes') },
        { label: 'Total comments', value: sumOf(items, 'comments') },
    ].filter((metric): metric is { label: string; value: number } => metric.value != null);

    return (
        // Same `.surface` token and padding as the pricing section and Instagram panel.
        <section className="rounded-[28px] border border-border bg-card p-4 shadow-card sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-brand">
                        <Briefcase className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="font-display text-lg font-semibold tracking-tight">Previous work with Mutiny</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {totalCampaigns} completed campaign{totalCampaigns === 1 ? '' : 's'}
                            {experience && <> · {experience}</>}
                            {items.length > 0 && ' · results from verified live posts'}
                        </p>
                    </div>
                </div>
                {totals.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {totals.map((metric) => (
                            <div key={metric.label} className="rounded-2xl bg-secondary/50 px-3.5 py-2">
                                <p className="text-[10px] text-muted-foreground">{metric.label}</p>
                                <p className="text-[15px] font-semibold tabular-nums">{compact(metric.value)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {items.length > 0 ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                        {visible.map((item) => <WorkCard key={item.id} item={item} />)}
                    </div>
                    {items.length > INITIAL_VISIBLE && (
                        <button
                            type="button"
                            onClick={() => setExpanded((value) => !value)}
                            className="mx-auto flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary/70 transition-premium"
                        >
                            {expanded ? 'Show less' : `Show all ${items.length}`}
                            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
                        </button>
                    )}
                </>
            ) : (
                // Empty state: a dashed tile with a black icon badge, same language as the list pages.
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-9 text-center">
                    <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-foreground text-brand">
                        <Briefcase className="h-5 w-5" />
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-card" />
                    </span>
                    <p className="mt-3 text-sm font-semibold">No Mutiny campaigns to show yet</p>
                    <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                        Completed campaigns with this creator will appear here, with their results and brand reviews.
                    </p>
                </div>
            )}
        </section>
    );
}
