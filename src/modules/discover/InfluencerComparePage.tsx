import { useState } from 'react';
import { ArrowUpRight, BadgeCheck, BarChart3, ChevronLeft, ChevronRight, Database, Loader2, MapPin, Plus, RotateCcw, Search, Star, TrendingUp, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import { PageHeader } from '@/shared/components/PageHeader';
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
      <section className="overflow-x-auto rounded-[28px] border border-border bg-card shadow-card lg:overflow-visible">
        {/* Full width with a fixed layout: the label column has a set width and the creator
            columns split the rest equally, so a long name can't widen its own column. */}
        <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-44 sm:w-56" />
            {ids.map((id) => <col key={id} />)}
          </colgroup>
          <thead>
            <tr>
              <th className={cn(labelCell, 'lg:sticky lg:top-16 z-20 rounded-tl-[28px] py-4 text-left align-bottom border-b')}>
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
                      i === ids.length - 1 && 'rounded-tr-[28px]',
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
                            <span className="relative shrink-0">
                              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-secondary font-bold ring-2 ring-card">
                                {creator.userAvatarUrl ? <ApiImage src={creator.userAvatarUrl} alt={creator.userName} className="w-full h-full object-cover" /> : creator.userName?.[0]}
                              </span>
                              <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-foreground text-[10px] font-bold text-brand ring-2 ring-card">{i + 1}</span>
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
                          className="grid h-7 w-7 -mr-1 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-[#E50914] hover:text-[#E50914] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                          title="Remove from comparison"
                          aria-label="Remove from comparison"
                        >
                          <X className="w-3.5 h-3.5" />
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
        <td colSpan={creators.length + 1} className="border-b border-border bg-card px-4 pb-2 pt-4">
          <span className="sticky left-4 inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ring-1 ring-brand/40">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {title}
          </span>
        </td>
      </tr>
      {metrics.map((metric, mi) => {
        const values = creators.map((c) => (c ? metric.value(c) : null));
        const leaders = bestIndexes(values, metric.best);
        const lastRow = isLast && mi === metrics.length - 1;
        return (
          <tr key={metric.label}>
            <td className={cn(labelCell, 'py-3 text-xs text-muted-foreground', !lastRow && 'border-b', lastRow && 'rounded-bl-[28px]')}>
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
                    isBest && 'bg-brand/[0.08]',
                    lastRow && i === values.length - 1 && 'rounded-br-[28px]',
                  )}
                >
                  {queries[i]?.isLoading ? (
                    <div className="h-4 w-20 rounded bg-secondary animate-pulse" />
                  ) : !value || value.text === UNAVAILABLE ? (
                    <span className="text-muted-foreground/60" title="No data">—</span>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold break-words">
                      {value.text}
                      {isBest && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-brand">
                          <Star className="h-2.5 w-2.5 fill-brand" />
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
    <section className="mb-6 rounded-[28px] border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">Pick your contenders</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tap a creator to add them to the lineup{full ? ' — it\'s full, remove one to swap.' : '.'}
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search by name or handle..."
            className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-9 text-sm shadow-sm transition-all focus:border-foreground/30 focus:outline-none focus:ring-4 focus:ring-brand/20"
          />
          {isFetching && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
      </div>


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
                    'group/pick flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-all duration-200',
                    selected ? 'border-brand bg-brand/[0.07] ring-2 ring-brand/30' : 'border-border hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-card',
                    disabled && 'cursor-not-allowed opacity-50 hover:translate-y-0 hover:border-border hover:shadow-none',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-bold">
                    {inf.userAvatarUrl ? <ApiImage src={inf.userAvatarUrl} alt={inf.userName} className="w-full h-full object-cover" /> : inf.userName?.[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{inf.userName}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[inf.handle, inf.followerCount ? `${formatNumber(inf.followerCount)} followers` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {/* Slot number once picked; a + before */}
                  <span className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-all duration-200',
                    selected ? 'bg-foreground text-brand' : 'border border-border text-muted-foreground group-hover/pick:border-foreground/40 group-hover/pick:text-foreground',
                  )}>
                    {selected ? creators.findIndex((c) => c.id === inf.id) + 1 : <Plus className="h-3 w-3" />}
                  </span>
                </button>
              );
            })}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card transition-colors hover:border-foreground disabled:opacity-40" aria-label="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Page <strong className="font-semibold text-foreground">{page}</strong> of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card transition-colors hover:border-foreground disabled:opacity-40" aria-label="Next page">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * The lineup: a rail with one round slot per creator (up to MAX_COMPARE). Picked slots show the
 * creator; open ones are dashed and numbered. The rail fills yellow from slot to slot as the
 * lineup grows.
 */
function CompareLineup() {
  const creators = useCompareStore((state) => state.creators);
  const remove = useCompareStore((state) => state.remove);
  const slots = Array.from({ length: MAX_COMPARE }, (_, i) => creators[i] ?? null);
  const needed = Math.max(0, 2 - creators.length);
  // The rail runs between the first and last slot centres (half a column in from each edge).
  const edge = 50 / MAX_COMPARE;
  const filledSpan = creators.length > 1 ? ((creators.length - 1) / (MAX_COMPARE - 1)) * (100 - edge * 2) : 0;

  return (
    <section className="mb-5 animate-fade-up rounded-[28px] border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 ring-1 ring-brand/40"><Users className="h-4 w-4" /></span>
          <div>
            <p className="font-display text-base font-semibold tracking-tight">Your lineup</p>
            <p className="text-xs text-muted-foreground">
              {needed > 0
                ? `Pick ${needed} more creator${needed === 1 ? '' : 's'} to see them side by side.`
                : 'Ready — the comparison is below.'}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums">
          {creators.length}<span className="text-muted-foreground"> / {MAX_COMPARE}</span>
        </span>
      </div>

      <div className="relative mt-5">
        {/* The rail behind the slots, and its yellow fill */}
        <svg aria-hidden viewBox="0 0 100 2" preserveAspectRatio="none" className="absolute inset-x-0 top-[27px] h-0.5 w-full">
          <rect x={edge} width={100 - edge * 2} height="2" rx="1" className="fill-foreground/[0.08]" />
          <rect x={edge} width={filledSpan} height="2" rx="1" className="fill-brand transition-[width] duration-500 ease-out" />
        </svg>
        {filledSpan > 0 && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute top-[25px] h-1.5 w-12 rounded-full bg-gradient-to-r from-transparent via-white to-transparent"
            initial={{ left: `${edge}%`, opacity: 0 }}
            animate={{ left: [`${edge}%`, `calc(${edge + filledSpan}% - 3rem)`], opacity: [0, 1, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}
          />
        )}

        <ol className="relative grid grid-cols-4">
          {slots.map((slot, i) => (
            <li key={i} className="flex min-w-0 flex-col items-center px-1 text-center">
              {slot ? (
                <div className="group/slot relative animate-pop transition-transform duration-300 hover:-translate-y-1">
                  <span aria-hidden className="absolute -inset-2 rounded-full bg-brand/35 blur-md transition-opacity duration-300 group-hover/slot:opacity-100 opacity-70" />
                  <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-secondary font-display text-lg font-bold ring-[3px] ring-brand ring-offset-2 ring-offset-card">
                    {slot.avatarUrl ? <ApiImage src={slot.avatarUrl} alt={slot.name} className="h-full w-full object-cover transition-transform duration-500 group-hover/slot:scale-110" /> : slot.name?.[0]}
                  </span>
                  <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-foreground text-[10px] font-bold text-brand ring-2 ring-card">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => remove(slot.id)}
                    aria-label={`Remove ${slot.name}`}
                    title="Remove from lineup"
                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-card text-muted-foreground opacity-0 shadow-card ring-1 ring-border transition-all hover:text-[#E50914] focus-visible:opacity-100 group-hover/slot:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-foreground/15 bg-card font-display text-sm font-semibold text-muted-foreground">
                  {i + 1}
                </span>
              )}
              <p className={cn('mt-2.5 w-full truncate text-xs font-semibold', !slot && 'font-medium text-muted-foreground')}>
                {slot ? slot.name : i < 2 ? 'Pick a creator' : 'Optional'}
              </p>
              {slot ? (
                <span className="mt-1 max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {slot.handle ? `@${String(slot.handle).replace(/^@/, '')}` : 'Creator'}
                </span>
              ) : (
                <p className="w-full truncate text-[10px] text-muted-foreground">Slot {i + 1}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function InfluencerComparePage() {
  const creators = useCompareStore((state) => state.creators);
  const clear = useCompareStore((state) => state.clear);

  return (
    <div className="w-full pb-12 animate-fade-in">
      <Link to="/discover" className="group/back mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft className="h-4 w-4 transition-transform group-hover/back:-translate-x-0.5" />
        Influencers
      </Link>
      <PageHeader
        title="Compare influencers"
        description="Line up 2 to 4 creators and see audience, performance, price and trust side by side."
        animated
        size="lg"
        hideHireManager
        actions={creators.length > 0 ? (
          <button
            type="button"
            onClick={clear}
            className="group/clear inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-semibold shadow-sm transition-colors hover:border-[#E50914] hover:text-[#E50914]"
          >
            <RotateCcw className="h-4 w-4 transition-transform duration-500 group-hover/clear:-rotate-180" />
            Clear lineup
          </button>
        ) : undefined}
      />

      <CompareLineup />
      <ComparePicker />

      {creators.length >= 2 && <CompareTable ids={creators.map((creator) => creator.id)} />}
    </div>
  );
}
