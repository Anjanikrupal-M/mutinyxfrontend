import {
  AlertTriangle,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  ExternalLink,
  Eye,
  Heart,
  ImageOff,
  Info,
  Instagram,
  LayoutGrid,
  MessageCircle,
  MousePointerClick,
  Repeat2,
  Reply,
  Share2,
  Sparkles,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Activity,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import type { AnalyticsAvailability, AudienceBreakdown, InstagramInsightsPayload } from '../influencer-display';
import { cn } from '@/lib/utils';
import { ColumnChart, DonutChart, FunnelChart, RankedBars, SplitBar, TrendAreaChart, type ChartSegment } from '@/shared/components/insights/InsightCharts';
import { toneClasses, type Tone } from '@/shared/components/insights/insightTones';
import { MediaThumb } from '@/shared/components/MediaThumb';

type Icon = typeof Users;

const formatNumber = (value: number | undefined | null) => {
  if (value == null) return 'Unavailable';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return value.toLocaleString('en-IN');
};

const formatPercent = (value: number | null | undefined) => value == null ? 'Unavailable' : `${value.toFixed(2)}%`;

function formatDate(value: string | null) {
  if (!value) return 'not synced';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'not synced'
    : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatShortDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelative(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function countryName(code: string | null | undefined) {
  if (!code) return null;
  if (/^[A-Za-z]{2}$/.test(code) && typeof Intl.DisplayNames === 'function') {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  }
  return code;
}

/* ------------------------------------------------------------------ */
/* Plain-language copy                                                 */
/* ------------------------------------------------------------------ */

const funnelSteps: Array<{ key: string; label: string; hint: string; icon: Icon }> = [
  { key: 'views', label: 'Views', hint: 'Times content was shown, repeats included', icon: Eye },
  { key: 'reach', label: 'Reach', hint: 'Different accounts that saw it', icon: Users },
  { key: 'accounts_engaged', label: 'Accounts engaged', hint: 'Different accounts that interacted', icon: UserCheck },
];

const activityMetrics: Array<{ key: string; label: string; hint: string; icon: Icon }> = [
  { key: 'likes', label: 'Likes', hint: 'Hearts on posts', icon: Heart },
  { key: 'comments', label: 'Comments', hint: 'Comments left', icon: MessageCircle },
  { key: 'shares', label: 'Shares', hint: 'Sent to others', icon: Share2 },
  { key: 'saves', label: 'Saves', hint: 'Saved for later', icon: Bookmark },
  { key: 'replies', label: 'Replies', hint: 'Replies to stories', icon: Reply },
  { key: 'reposts', label: 'Reposts', hint: 'Reposted by others', icon: Repeat2 },
  { key: 'profile_links_taps', label: 'Profile actions', hint: 'Bio link, email, call taps', icon: MousePointerClick },
];

const providerValueLabels: Record<string, Record<string, string>> = {
  Gender: {
    M: 'Male',
    MALE: 'Male',
    F: 'Female',
    FEMALE: 'Female',
    U: 'Unknown',
    UNKNOWN: 'Unknown',
    UNSPECIFIED: 'Unspecified',
  },
  'Views by format': {
    POST: 'Feed posts',
    REEL: 'Reels',
    STORY: 'Stories',
    CAROUSEL_CONTAINER: 'Carousel posts',
    IGTV: 'Instagram TV videos',
  },
  'Follow movement': {
    FOLLOWER: 'Followers',
    NON_FOLLOWER: 'Non-followers',
    FOLLOWS: 'New follows',
    UNFOLLOWS: 'Unfollows',
  },
  'Profile actions': {
    BIO_LINK: 'Biography link',
    CALL: 'Call button',
    DIRECTION: 'Directions button',
    EMAIL: 'Email button',
    TEXT: 'Text message button',
  },
};

const syncStatusCopy: Record<string, { label: string; tone: Tone }> = {
  fresh: { label: 'Up to date', tone: 'good' },
  stale: { label: 'Out of date', tone: 'warn' },
  failed: { label: 'Last sync failed', tone: 'bad' },
  reauth_required: { label: 'Reconnect needed', tone: 'bad' },
};

const availabilityCopy: Record<AnalyticsAvailability['status'], { label: string; tone: Tone }> = {
  available: { label: 'All breakdowns available', tone: 'good' },
  partial: { label: 'Some breakdowns withheld', tone: 'warn' },
  unavailable: { label: 'Not available', tone: 'neutral' },
};

const availabilityReasonCopy: Record<NonNullable<AnalyticsAvailability['reason']>, string> = {
  below_meta_threshold: 'Meta hides some breakdowns until an account is large enough to keep individuals anonymous.',
  permission_or_metric_unavailable: 'Meta does not provide this data for this account.',
  request_failed: 'The last attempt to fetch this data from Meta did not succeed.',
};

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap', toneClasses[tone], className)}>
      {children}
    </span>
  );
}

function SectionTitle({ title, description, aside }: { title: string; description?: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** A soft inset tile — the one container style used for every chart and list in the panel. */
function Tile({ title, caption, aside, children, className }: {
  title: string;
  caption?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    /* Grid rows stretch every tile to the tallest one. A growing, vertically centred body
       turns the leftover height in a short tile (a two-row split bar next to a donut, say)
       into balanced margin rather than a void underneath the content. */
    <div className={cn('flex min-w-0 flex-col rounded-2xl bg-secondary/40 p-3.5 sm:p-4', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          {caption && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{caption}</p>}
        </div>
        {aside}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

function Empty({ title = 'Data unavailable', message }: { title?: string; message: string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 px-6 py-10 text-center">
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground">
        <Info className="w-4 h-4" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">{message}</p>
    </div>
  );
}

/** Pass value 'Unavailable' to render the missing state with `missingHint`. */
function Metric({ label, value, icon: MetricIcon, hint, missingHint = 'Not provided by Meta' }: {
  label: string;
  value: string;
  icon: Icon;
  hint: string;
  missingHint?: string;
}) {
  const missing = value === 'Unavailable';
  return (
    <div className="min-w-0 rounded-2xl bg-secondary/40 p-3.5">
      <p className="flex items-start gap-1.5 text-xs font-medium text-muted-foreground">
        <MetricIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span className="leading-snug">{label}</span>
      </p>
      <p className={cn('mt-1.5 font-display font-semibold tabular-nums tracking-tight leading-none', missing ? 'text-lg text-muted-foreground/50' : 'text-[22px]')}>
        {missing ? '—' : value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{missing ? missingHint : hint}</p>
    </div>
  );
}

function titleCase(label: string) {
  return label.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Turns a Meta breakdown map into labelled chart segments, in a stable order when one is known. */
function toSegments(title: string, values: Record<string, number> | undefined, order?: string[]): ChartSegment[] {
  const countryNames = title === 'Top countries' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;
  const displayLabel = (label: string) => {
    if (countryNames && /^[A-Za-z]{2}$/.test(label)) return countryNames.of(label.toUpperCase()) ?? label;
    return providerValueLabels[title]?.[label.toUpperCase()] ?? titleCase(label);
  };
  const entries = Object.entries(values ?? {});
  if (order) {
    const rank = (key: string) => {
      const index = order.indexOf(key.toUpperCase());
      return index < 0 ? order.length : index;
    };
    entries.sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1]);
  } else {
    entries.sort((a, b) => b[1] - a[1]);
  }
  return entries.map(([key, value]) => ({ key, label: displayLabel(key), value }));
}

function ageRank(label: string) {
  const start = Number.parseInt(label, 10);
  return Number.isNaN(start) ? Number.MAX_SAFE_INTEGER : start;
}

function AudienceGroup({ data, emptyMessage }: { data?: AudienceBreakdown; emptyMessage: string }) {
  const hasData = data && Object.values(data).some((value) => value && Object.keys(value).length > 0);
  if (!hasData) {
    return <Empty title="Not shared by Meta yet" message={emptyMessage} />;
  }
  const age = toSegments('Age', data.age).sort((a, b) => ageRank(a.key) - ageRank(b.key));
  const gender = toSegments('Gender', data.gender, ['F', 'FEMALE', 'M', 'MALE', 'U', 'UNKNOWN', 'UNSPECIFIED']);
  const countries = toSegments('Top countries', data.countries);
  const cities = toSegments('Top cities', data.cities);
  return (
    // All four across on a wide screen. Two-up stacked them into two tall rows and made the
    // country and city bars absurdly long for a 0.5% value; at quarter width the whole
    // audience picture fits on one screen without scrolling.
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
      {age.length > 0 && (
        <Tile title="Age">
          <ColumnChart items={age} />
        </Tile>
      )}
      {gender.length > 0 && (
        <Tile title="Gender">
          <DonutChart segments={gender} />
        </Tile>
      )}
      {countries.length > 0 && (
        <Tile title="Top countries">
          <RankedBars items={countries} max={6} />
        </Tile>
      )}
      {cities.length > 0 && (
        <Tile title="Top cities">
          <RankedBars items={cities} max={6} />
        </Tile>
      )}
    </div>
  );
}

function PerformanceTrend({ points, className }: { points: NonNullable<InstagramInsightsPayload['performanceTrend']>; className?: string }) {
  // Creators sync several times a day; keep the latest reading per day so the axis reads as dates.
  const byDay = new Map<string, (typeof points)[number]>();
  for (const point of points) {
    if (point.reach == null) continue;
    const day = new Date(point.collectedAt).toDateString();
    const kept = byDay.get(day);
    if (!kept || new Date(point.collectedAt) > new Date(kept.collectedAt)) byDay.set(day, point);
  }
  const recent = [...byDay.values()]
    .sort((left, right) => new Date(left.collectedAt).getTime() - new Date(right.collectedAt).getTime())
    .slice(-14);
  if (recent.length < 2) return null;
  const first = recent[0].reach ?? 0;
  const last = recent[recent.length - 1].reach ?? 0;
  const change = first > 0 ? ((last - first) / first) * 100 : null;
  return (
    <Tile
      className={className}
      title="Reach over time"
      aside={change != null && (
        <Pill tone={change >= 0 ? 'good' : 'bad'}>
          <TrendingUp className={cn('w-3 h-3', change < 0 && 'rotate-180')} />
          {change >= 0 ? '+' : ''}{change.toFixed(1)}% since {formatShortDate(recent[0].collectedAt)}
        </Pill>
      )}
    >
      {/* The chart fills its tile. Keeping a sparse series narrow is right, but capping the
          plot inside a full-width tile just moved the empty space inside the card — the tile
          is sized by its grid column instead, so the plot always fills what it is given. */}
      <TrendAreaChart
        points={recent.map((point) => ({
          date: formatDate(point.collectedAt),
          label: new Date(point.collectedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          value: point.reach ?? 0,
        }))}
      />
    </Tile>
  );
}

type ContentItem = NonNullable<InstagramInsightsPayload['content']>[number];

const contentFormatLabels: Record<string, string> = {
  reel: 'Reel',
  carousel: 'Carousel',
  'feed-image': 'Feed image',
  'feed-video': 'Feed video',
  story: 'Story',
};

function contentFormatLabel(format: string) {
  return contentFormatLabels[format] ?? format.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rankingSignal(item: ContentItem): number {
  return item.metrics?.totalInteractions ?? item.metrics?.reach ?? item.metrics?.views ?? -1;
}

const TOP_CONTENT_PER_FORMAT = 3;

function ContentCard({ item, rank }: { item: ContentItem; rank: number }) {
  const visibleMetrics = item.metrics ? [
    { label: 'Views', value: item.metrics.views },
    { label: 'Reach', value: item.metrics.reach },
    { label: 'Likes', value: item.metrics.likes },
    { label: 'Comments', value: item.metrics.comments },
    { label: 'Shares', value: item.metrics.shares },
    { label: 'Saves', value: item.metrics.saves },
  ].filter((metric): metric is { label: string; value: number } => metric.value != null) : [];
  // Meta can report fewer accounts reached than interactions (e.g. 26 reach vs 325 likes), which
  // yields rates over 100%. That number means nothing to a brand, so it is not shown.
  const rawEngagement = item.metrics?.engagementRate;
  const engagementRate = rawEngagement != null && rawEngagement <= 100 ? rawEngagement : null;
  const postedOn = formatShortDate(item.publishedAt);

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl bg-secondary/40">
      <div className="relative">
        <MediaThumb
          src={item.thumbnailUrl}
          alt={`${contentFormatLabel(item.format)} Instagram content`}
          className="aspect-[4/5]"
          imageClassName="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent" />
        <span className={cn(
          'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md',
          rank === 1 ? 'bg-[#fedc03] text-black' : 'bg-white/85 text-black',
        )}>
          {rank === 1 && <Trophy className="h-3 w-3" />}#{rank} {contentFormatLabel(item.format)}
        </span>
        {item.permalink && (
          <a
            href={item.permalink}
            target="_blank"
            rel="noreferrer"
            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-black backdrop-blur-md hover:bg-white"
            aria-label="Open on Instagram"
            title="Open on Instagram"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {engagementRate != null && (
          <span
            className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md"
            title="Interactions per account reached"
          >
            {formatPercent(engagementRate)} eng.
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2.5 min-w-0">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
          {postedOn && <span>Posted {postedOn}</span>}
          {item.carouselItemCount > 0 && <span>· {item.carouselItemCount} items</span>}
        </div>

        {item.caption && <p className="text-[11px] text-foreground/75 line-clamp-2 leading-snug [overflow-wrap:anywhere]" title={item.caption}>{item.caption}</p>}

        {visibleMetrics.length > 0 ? (
          <dl className="mt-auto grid grid-cols-3 gap-y-2 rounded-lg bg-card px-0.5 py-2">
            {visibleMetrics.map((metric) => (
              <div key={metric.label} className="min-w-0 text-center">
                <dt className="truncate text-[10px] text-muted-foreground">{metric.label}</dt>
                <dd className="truncate text-[13px] font-semibold tabular-nums leading-tight">{formatNumber(metric.value)}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="text-[11px] text-muted-foreground">No content metrics were returned for this item.</p>}

        {item.metricsCollectedAt && (
          <p className="truncate text-[10px] text-muted-foreground" title={`Metrics observed ${formatDate(item.metricsCollectedAt)}`}>
            Observed {formatShortDate(item.metricsCollectedAt)}
            {item.insightsStatus === 'unavailable' ? ' · latest refresh unavailable' : item.insightsStatus === 'not_refreshed' ? ' · not due for refresh' : ''}
          </p>
        )}
      </div>
    </article>
  );
}

function TopContentSection({ title, items, emptyMessage }: { title: string; items: ContentItem[]; emptyMessage: string }) {
  return (
    <div className="space-y-3">
      <SectionTitle title={title} aside={items.length > 0 && <Pill tone="neutral">Top {items.length}</Pill>} />
      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item, index) => <ContentCard key={item.id} item={item} rank={index + 1} />)}
        </div>
      ) : (
        <p className="rounded-2xl bg-secondary/40 px-4 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  );
}

function PanelHeader({ verified, children }: { verified?: boolean; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-brand">
        <Instagram className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-1.5">
          Instagram insights
          {verified && <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-label="Meta verified" />}
        </h2>
        {children}
      </div>
    </div>
  );
}

// Same `.surface` token as the profile page's sections and the campaign Analytics tab.
const surfaceClass = 'rounded-[28px] border border-border bg-card p-4 shadow-card sm:p-5';

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function InstagramInsightsPanel({ insights }: { insights: InstagramInsightsPayload }) {
  if (!insights.connected) {
    return (
      <section className={cn(surfaceClass, 'space-y-5')}>
        <PanelHeader>
          <p className="text-xs text-muted-foreground mt-0.5">Verified analytics pulled directly from Instagram</p>
        </PanelHeader>
        <Empty
          title={insights.requiresReconnect ? 'Instagram needs to be reconnected' : 'Instagram not connected'}
          message={insights.requiresReconnect
            ? 'The creator must reconnect through official Instagram Login before verified analytics can be shown.'
            : 'This creator has not connected a professional Instagram account through official Instagram Login.'}
        />
      </section>
    );
  }

  const { performance, topPosts } = insights;
  const accountPerformance = insights.accountPerformance ?? {
    period: 'day' as const,
    since: null,
    until: null,
    metrics: {},
    breakdowns: [],
    availability: { status: 'unavailable' as const, collectedAt: null },
  };
  const audience = insights.audience ?? {
    availability: { status: 'unavailable' as const, collectedAt: null },
  };
  const provenance = insights.provenance ?? {
    source: 'legacy_unverified' as const,
    verified: false,
    graphVersion: null,
    collectedAt: insights.lastSyncedAt,
    status: 'stale' as const,
  };
  const coverageLevel = insights.dataCoverage?.level ?? 'limited';
  const accountMetrics = accountPerformance.metrics ?? {};
  const accountBreakdowns = accountPerformance.breakdowns ?? [];
  const mediaProductViews = accountBreakdowns.find((item) => item.metric === 'views' && item.dimension === 'media_product_type')?.values;
  const followMovement = accountBreakdowns.find((item) => item.metric === 'follows_and_unfollows' && item.dimension === 'follow_type')?.values;
  const profileActions = accountBreakdowns.find((item) => item.metric === 'profile_links_taps' && item.dimension === 'contact_button_type')?.values;
  const reportingStart = formatShortDate(accountPerformance.since);
  const reportingEnd = formatShortDate(accountPerformance.until);
  const content = insights.content ?? [];
  const topOfFormat = (format: string) => content
    .filter((item) => item.format === format)
    .sort((left, right) => rankingSignal(right) - rankingSignal(left))
    .slice(0, TOP_CONTENT_PER_FORMAT);
  const topReels = topOfFormat('reel');
  const topCarousels = topOfFormat('carousel');

  const coverage = coverageLevel === 'full'
    ? { label: 'Full data coverage', tone: 'good' as const }
    : coverageLevel === 'partial'
      ? { label: 'Some insights unavailable', tone: 'warn' as const }
      : { label: 'Limited data available', tone: 'neutral' as const };
  const syncStatus = syncStatusCopy[provenance.status] ?? { label: provenance.status.replace(/_/g, ' '), tone: 'neutral' as const };
  const needsAttention = provenance.status === 'reauth_required' || provenance.status === 'failed' || provenance.status === 'stale';
  const syncedAgo = formatRelative(provenance.collectedAt);
  const audienceStatus = availabilityCopy[audience.availability.status];
  const hasAccountMetrics = Object.keys(accountMetrics).length > 0;

  // One-sentence plain-English takeaway, built only from values that exist.
  const reach = accountMetrics.reach;
  const engaged = accountMetrics.accounts_engaged;
  const topCountry = countryName(insights.summary?.topCountry);
  const topAgeGroup = insights.summary?.topAgeGroup;
  const takeaway: ReactNode[] = [];
  if (reach != null) {
    takeaway.push(
      <span key="reach">
        In the last 30 days this creator’s content reached <strong className="font-semibold text-foreground">{formatNumber(reach)} accounts</strong>
        {engaged != null && reach > 0 && (
          <>, and <strong className="font-semibold text-foreground">{formatNumber(engaged)}</strong> of them interacted ({((engaged / reach) * 100).toFixed(1)}%)</>
        )}
        .
      </span>,
    );
  }
  if (topCountry || topAgeGroup) {
    takeaway.push(
      <span key="audience">
        {' '}Most followers are
        {topCountry && <> in <strong className="font-semibold text-foreground">{topCountry}</strong></>}
        {topCountry && topAgeGroup && ','}
        {topAgeGroup && <> aged <strong className="font-semibold text-foreground">{topAgeGroup}</strong></>}
        .
      </span>,
    );
  }

  const contentMix: ChartSegment[] = [
    { key: 'video', label: 'Videos & reels', value: performance.contentMix?.video ?? 0 },
    { key: 'image', label: 'Photos', value: performance.contentMix?.image ?? 0 },
    { key: 'carousel', label: 'Carousels', value: performance.contentMix?.carousel ?? 0 },
  ].filter((segment) => segment.value > 0);

  const interactionSegments: ChartSegment[] = activityMetrics
    .filter((metric) => metric.key !== 'profile_links_taps' && accountMetrics[metric.key] != null && accountMetrics[metric.key] > 0)
    .map((metric) => ({ key: metric.key, label: metric.label, value: accountMetrics[metric.key] }));
  const missingInteractions = hasAccountMetrics
    ? activityMetrics.filter((metric) => metric.key !== 'profile_links_taps' && accountMetrics[metric.key] == null).map((metric) => metric.label)
    : [];
  const viewsByFormat = toSegments('Views by format', mediaProductViews, ['REEL', 'POST', 'STORY', 'CAROUSEL_CONTAINER', 'IGTV']);
  const followSegments = toSegments('Follow movement', followMovement, ['FOLLOWS', 'UNFOLLOWS', 'FOLLOWER', 'NON_FOLLOWER']);
  const profileActionSegments = toSegments('Profile actions', profileActions);
  const breakdownCount = [viewsByFormat, followSegments, profileActionSegments].filter((segments) => segments.length > 0).length;
  const hasTrend = new Set((insights.performanceTrend ?? []).filter((point) => point.reach != null).map((point) => new Date(point.collectedAt).toDateString())).size >= 2;
  const overviewIsEmpty = takeaway.length === 0 && !insights.summary && !hasAccountMetrics && !hasTrend
    && breakdownCount === 0 && (content.length > 0 || topPosts.length === 0);

  const tabs: Array<{ value: string; label: string; icon: Icon }> = [
    { value: 'overview', label: 'Overview', icon: LayoutGrid },
    { value: 'audience', label: 'Audience', icon: Users },
    { value: 'content', label: 'Content', icon: Sparkles },
  ];

  return (
    <section className={cn(surfaceClass, 'space-y-5')}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <PanelHeader verified={provenance.verified}>
          <p className="text-xs text-muted-foreground mt-0.5" title={formatDate(provenance.collectedAt)}>
            {provenance.verified ? 'Official data from Meta' : 'Instagram data'} · synced {syncedAgo ?? formatDate(provenance.collectedAt)}
          </p>
        </PanelHeader>
        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          {reportingStart && reportingEnd && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
              <CalendarDays className="w-3 h-3" />
              <span className="font-semibold text-foreground">Last 30 days</span>
              <span className="tabular-nums">{reportingStart} – {reportingEnd}</span>
            </span>
          )}
          {provenance.status !== 'fresh' && <Pill tone={syncStatus.tone}>{syncStatus.label}</Pill>}
          {coverageLevel !== 'full' && <Pill tone={coverage.tone}>{coverage.label}</Pill>}
        </div>
      </div>

      {/* Attention banner: only when the numbers below may be outdated */}
      {needsAttention && (
        <div className={cn('flex gap-3 rounded-2xl border px-4 py-3', provenance.status === 'stale' ? toneClasses.warn : toneClasses.bad)}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <p className="font-semibold">
              {provenance.status === 'reauth_required'
                ? 'Instagram access has expired — numbers below are no longer updating'
                : provenance.status === 'failed'
                  ? 'The latest Instagram sync failed — numbers below may be outdated'
                  : 'These numbers have not been refreshed recently'}
            </p>
            <p className="text-foreground/70">Last successful data: {formatDate(provenance.collectedAt)}.</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full sm:w-auto sm:inline-grid h-auto grid-cols-3 gap-1 rounded-full bg-secondary p-1">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-1.5 rounded-full px-3 sm:px-5 py-1.5 text-xs sm:text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview — headline 30-day story, then how it was earned */}
        <TabsContent value="overview" className="pt-5 space-y-5">
          {takeaway.length > 0 && (
            <div className="flex gap-3 rounded-2xl bg-[#fedc03]/[0.12] px-4 py-3.5">
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
              <p className="text-sm leading-relaxed text-foreground/80">{takeaway}</p>
            </div>
          )}

          {insights.summary && (
            <div className="space-y-3">
              <SectionTitle
                title="30-day highlights"
              />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Metric
                  label="Follower growth"
                  value={formatPercent(insights.summary.followerGrowth30d)}
                  icon={TrendingUp}
                  hint="Change in followers"
                  missingHint="Needs about 3 weeks of sync history"
                />
                <Metric label="Engagement by reach" value={formatPercent(insights.summary.engagementByReach)} icon={Activity} hint="Interactions per account reached" />
                <Metric label="Save rate" value={formatPercent(insights.summary.saveRate)} icon={Bookmark} hint="Saves per account reached" />
                <Metric label="Share rate" value={formatPercent(insights.summary.shareRate)} icon={Share2} hint="Shares per account reached" />
              </div>
            </div>
          )}

          {hasAccountMetrics && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              <Tile
                className="lg:col-span-3"
                title="From seen to engaged"
              >
                <FunnelChart steps={funnelSteps.map((step) => ({ ...step, value: accountMetrics[step.key] }))} />
              </Tile>

              <Tile
                className="lg:col-span-2"
                title="What people did"
              >
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-semibold tracking-tight tabular-nums">
                    {accountMetrics.total_interactions == null ? '—' : formatNumber(accountMetrics.total_interactions)}
                  </span>
                  <span className="text-xs text-muted-foreground">total interactions</span>
                </div>
                {interactionSegments.length > 0
                  ? <RankedBars items={interactionSegments} valueMode="count" />
                  : <p className="text-xs text-muted-foreground">Meta did not return an interaction breakdown.</p>}
                {missingInteractions.length > 0 && (
                  <p className="mt-3 text-[11px] text-muted-foreground">Not returned by Meta: {missingInteractions.join(', ')}.</p>
                )}
              </Tile>
            </div>
          )}

          {/* Trend and breakdowns share one grid. On its own row the trend tile was the full
              width of the panel — around 1700px for a chart that often holds three days —
              and the breakdowns then wrapped below it. Treating it as one cell among the
              others fills the row with real content instead of stretching one chart across
              it, and the column count is chosen so the last row is never a lone stranded
              tile. */}
          {(hasTrend || breakdownCount > 0) && (() => {
            const cellCount = (hasTrend ? 1 : 0) + breakdownCount;
            const columns = cellCount <= 1
              ? 'max-w-3xl'
              : cellCount === 3
                ? 'md:grid-cols-2 xl:grid-cols-3'
                : 'md:grid-cols-2';
            return (
            <div className="space-y-3">
              <SectionTitle
                title={hasTrend ? 'Trend and breakdowns' : 'Breakdowns'}
              />
              <div className={cn('grid grid-cols-1 gap-3', columns)}>
                {hasTrend && insights.performanceTrend && <PerformanceTrend points={insights.performanceTrend} />}
                {viewsByFormat.length > 0 && (
                  <Tile title="Views by format">
                    <DonutChart segments={viewsByFormat} />
                  </Tile>
                )}
                {followSegments.length > 0 && (
                  <Tile title="Follow movement">
                    <SplitBar segments={followSegments} />
                  </Tile>
                )}
                {profileActionSegments.length > 0 && (
                  <Tile
                    title="Profile actions"
                    aside={accountMetrics.profile_links_taps != null && (
                      <span className="shrink-0 text-right">
                        <span className="block text-lg font-semibold leading-none tabular-nums">{formatNumber(accountMetrics.profile_links_taps)}</span>
                        <span className="text-[10px] text-muted-foreground">taps</span>
                      </span>
                    )}
                  >
                    <RankedBars items={profileActionSegments} valueMode="both" />
                  </Tile>
                )}
              </div>
            </div>
            );
          })()}

          {content.length === 0 && topPosts.length > 0 && (
            <div className="space-y-3">
              <SectionTitle title="Recent content signals" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {topPosts.map((post) => (
                  <a key={post.permalink} href={post.permalink} target="_blank" rel="noreferrer" className="group relative aspect-square rounded-2xl overflow-hidden bg-secondary block">
                    {post.thumbnail
                      ? <img src={post.thumbnail} alt="Instagram content" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageOff className="w-5 h-5" /></div>}
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-[11px] font-medium text-white">
                      <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(post.likeCount)}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatNumber(post.commentsCount)}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {overviewIsEmpty && (
            <Empty message="30-day Instagram insights are not available for this creator yet. Their headline numbers are shown above." />
          )}
        </TabsContent>

        {/* Audience */}
        <TabsContent value="audience" className="pt-5 space-y-4">
          <SectionTitle
            title="Audience composition"
            aside={audienceStatus && <Pill tone={audienceStatus.tone} className="hidden sm:inline-flex">{audienceStatus.label}</Pill>}
          />
          {audience.availability.reason && audience.availability.status !== 'available' && (
            <p className="flex gap-2 rounded-xl bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
              {availabilityReasonCopy[audience.availability.reason]}
            </p>
          )}
          <Tabs defaultValue="followers">
            <TabsList className="h-auto rounded-full bg-secondary p-1">
              <TabsTrigger value="followers" className="rounded-full px-4 py-1 text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Followers</TabsTrigger>
              <TabsTrigger value="engaged" className="rounded-full px-4 py-1 text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Engaged audience</TabsTrigger>
            </TabsList>
            <TabsContent value="followers" className="pt-4">
              <AudienceGroup
                data={audience.followers}
                emptyMessage="Meta only shares follower demographics for accounts with at least 100 followers, and may withhold breakdowns below its privacy thresholds."
              />
            </TabsContent>
            <TabsContent value="engaged" className="pt-4">
              <AudienceGroup
                data={audience.engaged}
                emptyMessage="Meta only shares this once at least 100 different accounts have interacted with the creator in the last 30 days."
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Content */}
        <TabsContent value="content" className="pt-5 space-y-5">
          {content.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The creator’s strongest recent posts, ranked by interactions (or reach and views where Meta withholds interactions).
              </p>
              {/* Side by side on wide screens so each post stays a sensible size. */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-7 xl:gap-6">
                <TopContentSection title="Top reels" items={topReels} emptyMessage="No reels among the creator’s recent posts." />
                <TopContentSection title="Top carousels" items={topCarousels} emptyMessage="No carousels among the creator’s recent posts." />
              </div>
            </>
          ) : (
            <Empty message="No recent Instagram content has been collected for this creator yet." />
          )}
          {contentMix.length > 0 && (
            <Tile title="What they post">
              <div className="max-w-xl">
                <DonutChart segments={contentMix} showCounts />
              </div>
            </Tile>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
