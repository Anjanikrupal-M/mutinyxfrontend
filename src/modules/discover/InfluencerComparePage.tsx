import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, BadgeCheck, BarChart3, Check, ChevronLeft, ChevronRight, Database, Loader2, MapPin, RotateCcw, Search, TrendingUp, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useInfluencerSearch, useInfluencersByIds, type Influencer } from './hooks/useInfluencers';
import { MAX_COMPARE, useCompareStore } from './stores/compareStore';

const PICKER_PAGE_SIZE = 12;

const formatNumber = (value: number | undefined | null) => {
  if (value == null) return 'Unavailable';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-IN');
};

const UNAVAILABLE = 'Unavailable';

/** A cell's display text, plus the number behind it when the row ranks creators. */
type MetricValue = { text: string; num?: number | null };

interface Metric {
  label: string;
  icon: typeof Users;
  value: (creator: Influencer) => MetricValue;
  /** Which end of the row gets the highlight; omitted rows are informational only. */
  best?: 'high' | 'low';
}

const percent = (value?: number | null): MetricValue =>
  value == null ? { text: UNAVAILABLE } : { text: `${value.toFixed(2)}%`, num: value };

const count = (value?: number | null): MetricValue =>
  value == null ? { text: UNAVAILABLE } : { text: formatNumber(value), num: value };

const insightMetrics = (creator: Influencer) => creator.instagramInsights?.accountPerformance?.metrics ?? {};

const METRIC_GROUPS: Array<{ title: string; metrics: Metric[] }> = [
  {
    title: 'Profile',
    metrics: [
      { label: 'Location', icon: MapPin, value: (c) => ({ text: c.location || UNAVAILABLE }) },
      { label: 'Niches', icon: BarChart3, value: (c) => ({ text: c.niches?.slice(0, 3).join(', ') || UNAVAILABLE }) },
    ],
  },
  {
    title: 'Audience',
    metrics: [
      { label: 'Followers', icon: Users, best: 'high', value: (c) => count(c.instagramInsights?.profile.followerCount ?? c.followerCount) },
      { label: 'Follower growth · 30d', icon: TrendingUp, best: 'high', value: (c) => percent(c.instagramInsights?.summary?.followerGrowth30d) },
      {
        label: 'Top follower country',
        icon: MapPin,
        value: (c) => ({
          text: Object.entries(c.instagramInsights?.audience?.followers?.countries ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? UNAVAILABLE,
        }),
      },
    ],
  },
  {
    title: 'Performance',
    metrics: [
      {
        label: 'Recent engagement',
        icon: BarChart3,
        best: 'high',
        value: (c) => {
          const insights = c.instagramInsights;
          if (!insights?.connected) return { text: UNAVAILABLE };
          const rate = Number(insights.performance.engagementRate);
          return { text: `${insights.performance.engagementRate}%`, num: Number.isFinite(rate) ? rate : null };
        },
      },
      { label: '30-day reach', icon: Users, best: 'high', value: (c) => count(insightMetrics(c).reach) },
      { label: '30-day interactions', icon: BarChart3, best: 'high', value: (c) => count(insightMetrics(c).total_interactions) },
      { label: 'Engagement by reach', icon: BarChart3, best: 'high', value: (c) => percent(c.instagramInsights?.summary?.engagementByReach) },
      { label: 'Save rate', icon: BarChart3, best: 'high', value: (c) => percent(c.instagramInsights?.summary?.saveRate) },
      { label: 'Share rate', icon: BarChart3, best: 'high', value: (c) => percent(c.instagramInsights?.summary?.shareRate) },
    ],
  },
  {
    title: 'Commercial & trust',
    metrics: [
      { label: 'Starting rate', icon: Database, best: 'low', value: (c) => startingRate(c.rateCard) },
      { label: 'Past collaborations', icon: BadgeCheck, best: 'high', value: (c) => ({ text: String(c.pastCollaborations ?? 0), num: c.pastCollaborations ?? 0 }) },
      { label: 'Instagram data', icon: Database, value: (c) => ({ text: coverageLabel(c.instagramInsights?.dataCoverage?.level) }) },
    ],
  },
];

function startingRate(rateCard?: Record<string, number>): MetricValue {
  const values = Object.values(rateCard ?? {}).map(Number).filter((value) => value > 0);
  if (values.length === 0) return { text: UNAVAILABLE };
  const lowest = Math.min(...values);
  return { text: `₹${lowest.toLocaleString('en-IN')}`, num: lowest };
}

function coverageLabel(level?: 'full' | 'partial' | 'limited') {
  if (level === 'full') return 'Full coverage';
  if (level === 'partial') return 'Some insights unavailable';
  return 'Limited data available';
}

/**
 * Indexes of the leading creators in a row. Needs at least two comparable numbers and a real
 * difference between them — highlighting a lone value, or everyone in a tie, says nothing.
 */
function bestIndexes(values: Array<MetricValue | null>, best?: 'high' | 'low'): Set<number> {
  if (!best) return new Set();
  const nums = values.map((v) => (v?.num != null && Number.isFinite(v.num) ? v.num : null));
  const present = nums.filter((n): n is number => n != null);
  if (present.length < 2) return new Set();
  const target = best === 'high' ? Math.max(...present) : Math.min(...present);
  if (present.every((n) => n === target)) return new Set();
  return new Set(nums.flatMap((n, i) => (n === target ? [i] : [])));
}

/** True when no creator in the row has data — such rows are hidden unless asked for. */
const isEmptyRow = (metric: Metric, creators: Array<Influencer | null>) =>
  creators.every((c) => !c || metric.value(c).text === UNAVAILABLE);

/**
 * Metrics as rows, creators as columns, so one metric reads across a single line. Columns have
 * a fixed width so two creators don't stretch across the whole page. The creator header sticks
 * under the topbar on desktop; below lg the table scrolls sideways instead (a horizontal scroll
 * container cannot also stick vertically), with the label column pinned.
 */
function CompareTable({ ids }: { ids: string[] }) {
  const remove = useCompareStore((state) => state.remove);
  const queries = useInfluencersByIds(ids);
  const creators = queries.map((q) => q.data ?? null);
  const [showEmpty, setShowEmpty] = useState(false);
  const labelCell = 'sticky left-0 z-[1] bg-card px-4 border-r border-border';

  // Rows nobody has data for are just a column of "Unavailable" — hide them once everything
  // has loaded (hiding mid-load would make rows jump in and out).
  const loading = queries.some((q) => q.isLoading);
  const hiddenCount = loading
    ? 0
    : METRIC_GROUPS.reduce((n, g) => n + g.metrics.filter((m) => isEmptyRow(m, creators)).length, 0);
  const groups = METRIC_GROUPS
    .map((g) => ({ ...g, metrics: showEmpty || loading ? g.metrics : g.metrics.filter((m) => !isEmptyRow(m, creators)) }))
    .filter((g) => g.metrics.length > 0);

  return (
    <div className="w-full">
      <section className="rounded-2xl border border-border bg-card overflow-x-auto lg:overflow-visible shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {/* Full width with a fixed layout: the label column has a set width and the creator
            columns split the rest equally, so a long name can't widen its own column. */}
        <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-44 sm:w-56" />
            {ids.map((id) => <col key={id} />)}
          </colgroup>
          <thead>
            <tr>
              <th className={cn(labelCell, 'lg:sticky lg:top-16 z-20 rounded-tl-2xl py-4 text-left align-bottom border-b')}>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Metric</span>
              </th>
              {ids.map((id, i) => {
                const query = queries[i];
                const creator = creators[i];
                return (
                  <th
                    key={id}
                    className={cn(
                      'lg:sticky lg:top-16 z-10 bg-card px-4 py-4 text-left font-normal align-top border-b border-border',
                      i < ids.length - 1 && 'border-r',
                      i === ids.length - 1 && 'rounded-tr-2xl',
                    )}
                  >
                    {query?.isLoading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-secondary animate-pulse shrink-0" />
                        <div className="h-4 flex-1 rounded bg-secondary animate-pulse" />
                      </div>
                    ) : (
                      // Same three lines for every creator (name, handle, link) so the
                      // headers line up even when a creator has no handle.
                      <div className="flex items-start gap-3 min-w-0">
                        {creator ? (
                          <>
                            <span className="w-11 h-11 rounded-xl bg-secondary overflow-hidden flex items-center justify-center font-bold shrink-0">
                              {creator.userAvatarUrl ? <ApiImage src={creator.userAvatarUrl} alt={creator.userName} className="w-full h-full object-cover" /> : creator.userName?.[0]}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-bold truncate" title={creator.userName}>{creator.userName}</span>
                              <span className="block text-xs text-muted-foreground truncate">{creator.handle || ' '}</span>
                              <Link
                                to={`/discover/${creator.id}`}
                                className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-foreground hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                              >
                                View profile <ArrowUpRight className="w-3.5 h-3.5" />
                              </Link>
                            </span>
                          </>
                        ) : (
                          <p className="flex-1 text-sm text-destructive">Creator unavailable.</p>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(id)}
                          className="p-1 -mr-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                          title="Remove from comparison"
                          aria-label="Remove from comparison"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map((group, gi) => (
              <MetricGroupRows
                key={group.title}
                title={group.title}
                metrics={group.metrics}
                creators={creators}
                queries={queries}
                labelCell={labelCell}
                isLast={gi === groups.length - 1}
              />
            ))}
          </tbody>
        </table>
      </section>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowEmpty((v) => !v)}
          className="mt-3 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded"
        >
          {showEmpty
            ? 'Hide metrics with no data'
            : `${hiddenCount} metric${hiddenCount === 1 ? '' : 's'} hidden — no data for these creators. Show all`}
        </button>
      )}
    </div>
  );
}

function MetricGroupRows({ title, metrics, creators, queries, labelCell, isLast }: {
  title: string;
  metrics: Metric[];
  creators: Array<Influencer | null>;
  queries: Array<{ isLoading: boolean }>;
  labelCell: string;
  isLast: boolean;
}) {
  return (
    <>
      <tr>
        <td colSpan={creators.length + 1} className="bg-secondary/60 px-4 py-2 border-b border-border">
          <span className="sticky left-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        </td>
      </tr>
      {metrics.map((metric, mi) => {
        const values = creators.map((c) => (c ? metric.value(c) : null));
        const leaders = bestIndexes(values, metric.best);
        const lastRow = isLast && mi === metrics.length - 1;
        return (
          <tr key={metric.label}>
            <td className={cn(labelCell, 'py-3 text-xs text-muted-foreground', !lastRow && 'border-b', lastRow && 'rounded-bl-2xl')}>
              <span className="flex items-center gap-1.5"><metric.icon className="w-3.5 h-3.5 shrink-0" />{metric.label}</span>
            </td>
            {values.map((value, i) => {
              const isBest = leaders.has(i);
              return (
                <td
                  key={i}
                  className={cn(
                    'px-4 py-3 border-border align-middle text-left',
                    !lastRow && 'border-b',
                    i < values.length - 1 && 'border-r',
                    isBest && 'bg-emerald-500/[0.06]',
                    lastRow && i === values.length - 1 && 'rounded-br-2xl',
                  )}
                >
                  {queries[i]?.isLoading ? (
                    <div className="h-4 w-20 rounded bg-secondary animate-pulse" />
                  ) : !value || value.text === UNAVAILABLE ? (
                    <span className="text-muted-foreground/60" title="No data">—</span>
                  ) : (
                    <span className={cn('inline-flex flex-wrap items-center gap-1.5 font-semibold break-words', isBest && 'text-emerald-700 dark:text-emerald-400')}>
                      {value.text}
                      {isBest && (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold">
                          {metric.best === 'low' ? 'Lowest' : 'Best'}
                        </span>
                      )}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

/**
 * Every influencer, searchable and paged, with a tick to add or remove them from the
 * comparison. Replaces the per-card compare icon on the Influencers page.
 */
function ComparePicker() {
  const creators = useCompareStore((state) => state.creators);
  const toggle = useCompareStore((state) => state.toggle);
  const remove = useCompareStore((state) => state.remove);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(query.trim(), 300);
  const { data, isLoading, isFetching } = useInfluencerSearch({ q: q || undefined, page, limit: PICKER_PAGE_SIZE });
  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PICKER_PAGE_SIZE));
  const selectedIds = new Set(creators.map((creator) => creator.id));
  const full = creators.length >= MAX_COMPARE;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Choose influencers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick 2 to {MAX_COMPARE}. {creators.length} selected{full ? ' — remove one to pick another.' : '.'}
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search by name or handle..."
            className="w-full h-10 pl-9 pr-9 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/50"
          />
          {isFetching && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {creators.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {creators.map((creator) => (
            <span key={creator.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 pl-1 pr-2 py-1 text-xs font-medium">
              <span className="w-5 h-5 rounded-full overflow-hidden bg-secondary flex items-center justify-center text-[10px] font-bold">
                {creator.avatarUrl ? <ApiImage src={creator.avatarUrl} alt={creator.name} className="w-full h-full object-cover" /> : creator.name?.[0]}
              </span>
              {creator.name}
              <button type="button" onClick={() => remove(creator.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${creator.name}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {isLoading
          ? Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-16 rounded-xl bg-secondary/60 animate-pulse" />)
          : rows.length === 0
            ? <p className="col-span-full py-6 text-center text-sm text-muted-foreground">No influencers match “{q}”.</p>
            : rows.map((inf) => {
              const selected = selectedIds.has(inf.id);
              const disabled = !selected && full;
              return (
                <button
                  key={inf.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => toggle({ id: inf.id, name: inf.userName ?? 'Unknown', handle: inf.handle, avatarUrl: inf.userAvatarUrl })}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-2.5 text-left transition-premium',
                    selected ? 'border-foreground bg-secondary/50' : 'border-border hover:border-foreground/30 hover:bg-secondary/30',
                    disabled && 'opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent',
                  )}
                >
                  <span className="w-10 h-10 rounded-lg overflow-hidden bg-secondary flex items-center justify-center font-bold shrink-0">
                    {inf.userAvatarUrl ? <ApiImage src={inf.userAvatarUrl} alt={inf.userName} className="w-full h-full object-cover" /> : inf.userName?.[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{inf.userName}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[inf.handle, inf.followerCount ? `${formatNumber(inf.followerCount)} followers` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={cn(
                    'w-5 h-5 rounded-md border flex items-center justify-center shrink-0',
                    selected ? 'border-foreground bg-foreground text-background' : 'border-border',
                  )}>
                    {selected && <Check className="w-3.5 h-3.5" />}
                  </span>
                </button>
              );
            })}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-40" aria-label="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-40" aria-label="Next page">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
}

export default function InfluencerComparePage() {
  const creators = useCompareStore((state) => state.creators);
  const clear = useCompareStore((state) => state.clear);

  return (
    <div className="w-full pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <Link to="/discover" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"><ArrowLeft className="w-4 h-4" />Back to Influencers</Link>
          <h1 className="text-2xl font-bold font-display">Compare influencers</h1>
          <p className="text-sm text-muted-foreground mt-1">Decision-ready creator, audience, performance, commercial, and trust signals side by side.</p>
        </div>
        {creators.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground shadow-sm hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive transition-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background shrink-0 self-start sm:self-auto"
          >
            <RotateCcw className="w-4 h-4" />
            Clear comparison
          </button>
        )}
      </div>

      <ComparePicker />

      {creators.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Users className="w-7 h-7 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Select at least two influencers</p>
          <p className="text-sm text-muted-foreground mt-1">Tick influencers in the list above — the comparison appears here. You can compare up to {MAX_COMPARE}.</p>
        </div>
      ) : (
        <CompareTable ids={creators.map((creator) => creator.id)} />
      )}
    </div>
  );
}
