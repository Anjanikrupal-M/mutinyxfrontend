import { BadgeCheck, Database, Instagram } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { toneClasses, type Tone } from './insightTones';

/*
 * Layout blocks shared by the creator Instagram intelligence panel and the campaign
 * Analytics tab, so both surfaces present metrics the same way.
 */

type Icon = typeof Database;

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap', toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export function SectionHeading({ title, description, aside }: { title: string; description?: string; aside?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

export function EmptyData({ title = 'Data unavailable', message }: { title?: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/20 px-6 py-8 text-center">
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
        <Database className="w-4 h-4 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">{message}</p>
    </div>
  );
}

/** Pass value 'Unavailable' to render the missing state with `missingHint`. */
export function Stat({ label, value, icon: StatIcon, hint, missingHint = 'Not provided by Meta', emphasis = false, title }: {
  label: string;
  value: string;
  icon: Icon;
  hint?: string;
  missingHint?: string;
  emphasis?: boolean;
  title?: string;
}) {
  const missing = value === 'Unavailable';
  return (
    /* A tile always sits inside a section card, so it gets a ring and no shadow — depth is
       never stacked. Emphasis is a tint plus a warmer ring, not a second elevation. */
    /* Compact by design: these tiles repeat four-to-a-row on the campaign totals and again
       inside every format section, so each 4px of padding is paid for many times down the
       page. Dense enough to read the whole picture without scrolling, not so tight that the
       number stops being the loudest thing in the tile. */
    <div className={cn(
      'flex min-w-0 flex-col rounded-xl p-3',
      emphasis
        ? 'bg-[#fedc03]/[0.07] shadow-[0_0_0_1px_hsl(49_98%_50%_/_0.45)]'
        : 'surface-inset',
    )}>
      <div className="flex items-start gap-1.5">
        <span className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded',
          emphasis ? 'bg-[#fedc03] text-black' : 'bg-secondary text-muted-foreground',
        )}>
          <StatIcon className="w-3 h-3" />
        </span>
        <span className="text-[11px] font-medium text-muted-foreground leading-snug pt-0.5">{label}</span>
      </div>
      {/* Semibold, not black: at this size the number already dominates, and weight is
          better spent separating the value from its label than shouting. */}
      <p
        className={cn(
          'mt-1.5 font-display font-semibold tabular-nums leading-none tracking-tight',
          missing ? 'text-lg text-muted-foreground/60' : 'text-[22px] capitalize',
        )}
        title={missing ? undefined : title}
      >
        {missing ? '—' : value}
      </p>
      {(hint || missing) && (
        <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{missing ? missingHint : hint}</p>
      )}
    </div>
  );
}

export function ChartCard({ title, caption, aside, children, className, bodyClassName }: {
  title: string;
  caption?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Extra classes on the growing body — e.g. `items-center` to centre a small chart. */
  bodyClassName?: string;
}) {
  return (
    /* Cards in a grid row are stretched to the tallest one. Without a growing body, a card
       with little in it (a comparison of one creator, say) pins its content to the top and
       leaves a void underneath. Centring the body vertically turns that leftover room into
       margin around the content instead of a hole below it. */
    <div className={cn('surface-inset flex flex-col rounded-xl p-4', className)}>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          {caption && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{caption}</p>}
        </div>
        {aside}
      </div>
      <div className={cn('flex min-w-0 flex-1 flex-col justify-center', bodyClassName)}>{children}</div>
    </div>
  );
}

export function InstagramHeader({ title, verified, children }: { title: string; verified?: boolean; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white shadow-sm">
        <Instagram className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold flex items-center gap-1.5">
          {title}
          {verified && <BadgeCheck className="w-4 h-4 text-emerald-600" aria-label="Meta verified" />}
        </h2>
        {children}
      </div>
    </div>
  );
}
