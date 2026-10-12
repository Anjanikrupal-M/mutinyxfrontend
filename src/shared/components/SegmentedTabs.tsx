import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// SegmentedTabs — the one switch style used everywhere inside the app (filters, tab bars,
// view toggles): a white pill with a hairline border; the active option is solid black with
// white text, and an optional count rides in a yellow badge (grey while inactive).
// For shadcn <Tabs>, use SEGMENT_LIST / SEGMENT_TRIGGER (+ SEGMENT_COUNT) for the same look.
// Not for the landing pages or the sign-in flow.
// ─────────────────────────────────────────────────────────────

export interface SegmentedTabItem<T extends string> {
    value: T;
    label: ReactNode;
    count?: number;
    icon?: LucideIcon;
    /** Small coloured dot before the label, e.g. "bg-emerald-500". */
    dot?: string;
    disabled?: boolean;
    title?: string;
}

interface SegmentedTabsProps<T extends string> {
    items: SegmentedTabItem<T>[];
    value: T;
    onChange: (value: T) => void;
    ariaLabel: string;
    /** Stretch to the container and share the width equally. */
    fullWidth?: boolean;
    className?: string;
}

export const SEGMENT_LIST = 'inline-flex h-auto w-fit items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-card';
export const SEGMENT_TRIGGER = 'group flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold text-muted-foreground transition-all duration-200 hover:text-foreground disabled:pointer-events-none disabled:opacity-40 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm';
/** Count badge inside a shadcn trigger: yellow when its tab is active, grey otherwise. */
export const SEGMENT_COUNT = 'rounded-full bg-secondary px-1.5 text-[10px] tabular-nums text-muted-foreground group-data-[state=active]:bg-brand group-data-[state=active]:text-foreground';

export function SegmentedTabs<T extends string>({ items, value, onChange, ariaLabel, fullWidth, className }: SegmentedTabsProps<T>) {
    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={cn(SEGMENT_LIST, fullWidth && 'flex w-full', className)}
        >
            {items.map((item) => {
                const active = item.value === value;
                const Icon = item.icon;
                return (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        disabled={item.disabled}
                        title={item.title}
                        onClick={() => onChange(item.value)}
                        className={cn(
                            // One size everywhere — don't override it per page.
                            'flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-40',
                            fullWidth && 'flex-1',
                            active ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {item.dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', item.dot)} />}
                        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                        {item.label}
                        {item.count != null && (
                            <span className={cn(
                                'rounded-full px-1.5 text-[10px] tabular-nums',
                                active ? 'bg-brand text-foreground' : 'bg-secondary text-muted-foreground',
                            )}>
                                {item.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
