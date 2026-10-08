import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';

/*
 * Small, dependency-light charts shared by the creator Instagram intelligence panel and the
 * campaign Analytics tab.
 *
 * Every chart keeps its values in HTML text (legends, value labels), so the numbers stay
 * readable without hovering and without relying on colour alone.
 *
 * Categorical colours are validated for colour-vision deficiency (adjacent CVD ΔE >= 8 in
 * light and dark). They are assigned by the caller's stable entity order, never by rank,
 * so "Reels" keeps its colour from one creator to the next.
 */

// Soft blue · teal · amber · pink · violet · red. Validated as an ordered set (adjacent pairs):
// light on #ffffff — worst CVD ΔE 9.1, normal-vision ΔE 19.6; dark on #1a1a19 — worst CVD
// ΔE 8.4, normal-vision ΔE 19.3, all >= 3:1. The light steps sit below 3:1, so charts using
// them keep their labelled legends.
const CATEGORICAL = [
  { stroke: 'stroke-[#5598e7] dark:stroke-[#3987e5]', bg: 'bg-[#5598e7] dark:bg-[#3987e5]' },
  { stroke: 'stroke-[#1baf7a] dark:stroke-[#199e70]', bg: 'bg-[#1baf7a] dark:bg-[#199e70]' },
  { stroke: 'stroke-[#eda100] dark:stroke-[#c98500]', bg: 'bg-[#eda100] dark:bg-[#c98500]' },
  { stroke: 'stroke-[#e87ba4] dark:stroke-[#d55181]', bg: 'bg-[#e87ba4] dark:bg-[#d55181]' },
  { stroke: 'stroke-[#4a3aa7] dark:stroke-[#9085e9]', bg: 'bg-[#4a3aa7] dark:bg-[#9085e9]' },
  { stroke: 'stroke-[#e34948] dark:stroke-[#e66767]', bg: 'bg-[#e34948] dark:bg-[#e66767]' },
];

const compactNumber = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return value.toLocaleString('en-IN');
};

export type ChartSegment = { key: string; label: string; value: number };

/** Folds anything past `max` segments into "Other" so the palette never cycles. */
function foldSegments(segments: ChartSegment[], max = CATEGORICAL.length) {
  if (segments.length <= max) return segments;
  const kept = segments.slice(0, max - 1);
  const rest = segments.slice(max - 1).reduce((sum, segment) => sum + segment.value, 0);
  return [...kept, { key: '__other', label: 'Other', value: rest }];
}

/* ------------------------------------------------------------------ */
/* Donut: part-to-whole, up to 6 segments                              */
/* ------------------------------------------------------------------ */

export function DonutChart({ segments, showCounts = false, formatValue = compactNumber }: { segments: ChartSegment[]; showCounts?: boolean; formatValue?: (value: number) => string }) {
  const [active, setActive] = useState<string | null>(null);
  const colored = foldSegments(segments.filter((segment) => segment.value > 0))
    .map((segment, index) => ({ ...segment, color: CATEGORICAL[index] }));
  const total = colored.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const gap = colored.length > 1 ? 1.4 : 0;
  let offset = 0;
  const arcs = colored.map((segment) => {
    const length = (segment.value / total) * circumference;
    const arc = { ...segment, length, offset };
    offset += length;
    return arc;
  });
  const largest = [...colored].sort((a, b) => b.value - a.value)[0];
  const focus = colored.find((segment) => segment.key === active) ?? null;
  const shown = focus ?? largest;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="Donut chart">
          <circle cx="50" cy="50" r={radius} fill="none" className="stroke-secondary" strokeWidth="12" />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              strokeWidth={active === arc.key ? 15 : 12}
              strokeDasharray={`${Math.max(arc.length - gap, 0.5)} ${circumference}`}
              strokeDashoffset={-arc.offset}
              className={cn(arc.color.stroke, 'cursor-pointer transition-[stroke-width,opacity] duration-150', active && active !== arc.key && 'opacity-40')}
              onMouseEnter={() => setActive(arc.key)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`${arc.label}: ${((arc.value / total) * 100).toFixed(1)}%`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <span className="text-xl font-bold leading-none">{((shown.value / total) * 100).toFixed(0)}%</span>
          <span className="mt-1 text-[10px] leading-tight text-muted-foreground">{focus ? `is ${focus.label.toLowerCase()}` : 'largest share'}</span>
        </div>
      </div>

      <ul className="w-full space-y-0.5">
        {[...colored].sort((a, b) => b.value - a.value).map((segment) => (
          <li
            key={segment.key}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2 py-1 text-xs transition-colors cursor-default',
              active === segment.key ? 'bg-secondary' : 'hover:bg-secondary/60',
            )}
            onMouseEnter={() => setActive(segment.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', segment.color.bg)} aria-hidden />
            <span className="flex-1 truncate text-foreground/80">{segment.label}</span>
            {showCounts && <span className="text-muted-foreground tabular-nums">{formatValue(segment.value)}</span>}
            <span className="w-12 text-right font-semibold tabular-nums">{((segment.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ranked horizontal bars: compare magnitude, largest emphasised       */
/* ------------------------------------------------------------------ */

export function RankedBars({ items, valueMode = 'percent', max = 8, formatValue = compactNumber }: {
  items: ChartSegment[];
  valueMode?: 'percent' | 'count' | 'both';
  max?: number;
  formatValue?: (value: number) => string;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const shown = sorted.slice(0, max);
  const peak = Math.max(...shown.map((item) => item.value), 1);
  if (shown.length === 0) return null;

  return (
    <div className="space-y-2">
      {shown.map((item, index) => {
        const share = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <div key={item.key} className="grid grid-cols-[minmax(0,7.5rem)_1fr] sm:grid-cols-[minmax(0,9rem)_1fr] items-center gap-3" title={`${item.label}: ${formatValue(item.value)} (${share.toFixed(1)}%)`}>
            <span className={cn('truncate text-xs', index === 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>{item.label}</span>
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-3 flex-1 min-w-0">
                <div
                  className={cn('h-full rounded-r-[4px] transition-[width] duration-500', index === 0 ? 'bg-[#fedc03]' : 'bg-[#fedc03]/45')}
                  style={{ width: `${Math.max((item.value / peak) * 100, item.value > 0 ? 2 : 0)}%` }}
                />
              </div>
              <span className="shrink-0 text-right text-xs tabular-nums">
                {valueMode !== 'percent' && <span className="font-semibold">{formatValue(item.value)}</span>}
                {valueMode === 'both' && <span className="text-muted-foreground"> · </span>}
                {valueMode !== 'count' && (
                  <span className={valueMode === 'both' ? 'text-muted-foreground' : 'font-semibold'}>{share.toFixed(1)}%</span>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Columns: ordered categories (age bands)                             */
/* ------------------------------------------------------------------ */

export function ColumnChart({ items }: { items: ChartSegment[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (items.length === 0 || total <= 0) return null;
  const peak = Math.max(...items.map((item) => item.value));

  return (
    <div>
      <div className="flex h-32 items-end gap-2 sm:gap-3 border-b border-border">
        {items.map((item) => {
          const share = (item.value / total) * 100;
          const isPeak = item.value === peak;
          return (
            <div key={item.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${item.label}: ${share.toFixed(1)}%`}>
              <span className={cn('mb-1 text-[10px] sm:text-xs tabular-nums', isPeak ? 'font-bold text-foreground' : 'text-muted-foreground')}>
                {share.toFixed(1)}%
              </span>
              <div
                className={cn('w-full max-w-[2.5rem] rounded-t-[4px]', isPeak ? 'bg-[#fedc03]' : 'bg-[#fedc03]/45')}
                style={{ height: `${Math.max((item.value / peak) * 78, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2 sm:gap-3">
        {items.map((item) => (
          <span key={item.key} className="min-w-0 flex-1 truncate text-center text-[10px] sm:text-[11px] text-muted-foreground">{item.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Split bar: a 100% stacked bar for two or three parts                */
/* ------------------------------------------------------------------ */

export function SplitBar({ segments, formatValue = compactNumber }: { segments: ChartSegment[]; formatValue?: (value: number) => string }) {
  const colored = foldSegments(segments.filter((segment) => segment.value > 0))
    .map((segment, index) => ({ ...segment, color: CATEGORICAL[index] }));
  const total = colored.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-[4px]">
        {colored.map((segment) => (
          <div
            key={segment.key}
            className={cn('h-full', segment.color.bg)}
            style={{ width: `${(segment.value / total) * 100}%` }}
            title={`${segment.label}: ${formatValue(segment.value)}`}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {colored.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2.5 text-xs">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', segment.color.bg)} aria-hidden />
            <span className="flex-1 truncate text-foreground/80">{segment.label}</span>
            <span className="font-semibold tabular-nums">{formatValue(segment.value)}</span>
            <span className="w-12 text-right text-muted-foreground tabular-nums">{((segment.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Funnel: each step as a share of the first                           */
/* ------------------------------------------------------------------ */

export function FunnelChart({ steps, conversionHint = 'of reached accounts interacted', formatValue = compactNumber }: {
  steps: Array<{ key: string; label: string; hint: string; value: number | null | undefined }>;
  /** Copy after the last step's percentage, e.g. "of reached accounts interacted". */
  conversionHint?: string;
  formatValue?: (value: number) => string;
}) {
  const first = steps.find((step) => step.value != null && step.value > 0)?.value ?? 0;
  return (
    <div className="space-y-1">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1].value : null;
        const conversion = previous && step.value != null && previous > 0 ? (step.value / previous) * 100 : null;
        const perAccount = index === 1 && previous != null && step.value ? previous / step.value : null;
        const width = first > 0 && step.value != null ? Math.max((step.value / first) * 100, 3) : 0;
        return (
          <div key={step.key}>
            {index > 0 && (
              <div className="flex items-center gap-2 py-1 pl-1 text-[11px] text-muted-foreground">
                <span className="h-3 w-px bg-border" aria-hidden />
                {index === 1
                  ? (perAccount != null
                    ? <span>Each account saw it about <span className="font-semibold text-foreground">{perAccount.toFixed(1)} times</span></span>
                    : <span>Comparison not available</span>)
                  : (conversion != null
                    ? <span><span className="font-semibold text-foreground">{conversion.toFixed(1)}%</span> {conversionHint}</span>
                    : <span>Conversion not available</span>)}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] items-center gap-x-4 gap-y-1.5">
              <div>
                <p className="text-xs font-medium">{step.label}</p>
                <p className="text-[11px] text-muted-foreground sm:mt-0.5">{step.hint}</p>
              </div>
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-6 flex-1 min-w-0 rounded-[4px] bg-secondary/60">
                  {step.value != null && (
                    <div
                      className={cn('h-full rounded-[4px] transition-[width] duration-500', index === steps.length - 1 ? 'bg-[#fedc03]' : 'bg-[#fedc03]/55')}
                      style={{ width: `${width}%` }}
                    />
                  )}
                </div>
                <span className={cn('w-14 shrink-0 text-right text-base font-bold', step.value == null && 'text-muted-foreground/60')}>
                  {step.value == null ? '—' : formatValue(step.value)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Area trend with hover tooltip                                       */
/* ------------------------------------------------------------------ */

export function TrendAreaChart({ points }: { points: Array<{ date: string; label: string; value: number }> }) {
  if (points.length < 2) return null;
  const gradientId = 'ig-reach-wash';
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#eda100" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#eda100" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value: number) => compactNumber(value)} />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as { date: string; value: number };
              return (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="text-muted-foreground">{point.date}</p>
                  <p className="mt-0.5 font-semibold">{compactNumber(point.value)} accounts reached</p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#eda100"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, stroke: 'hsl(var(--card))', strokeWidth: 2, fill: '#eda100' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
