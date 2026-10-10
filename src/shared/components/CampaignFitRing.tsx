import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import type { CampaignFitResult } from '@/shared/utils/campaignFit';

interface CampaignFitRingProps {
    fit: CampaignFitResult;
    /** Outer diameter in px. */
    size?: number;
    className?: string;
}

/**
 * The Campaign Fit score as a ring with its label underneath. Hovering it (or clicking / focusing)
 * opens the breakdown: every signal with its own bar, "—" for those with no data.
 * Used on applicant cards in the campaign Applications tab.
 *
 * Built on Popover rather than HoverCard because Popover renders in a portal: the cards clip
 * their overflow, and a breakdown drawn inside the card was cut off at its bottom edge.
 */
export function CampaignFitRing({ fit, size = 44, className }: CampaignFitRingProps) {
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const score = fit.score ?? 0;
    // Opens on hover like a hover card; the short close delay lets the pointer cross into the panel.
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const show = () => {
        clearTimeout(closeTimer.current);
        setOpen(true);
    };
    const hide = () => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setOpen(false), 120);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            {/* Only the ring itself opens the breakdown; the label underneath does not. */}
            <span className={cn('flex shrink-0 flex-col items-center gap-1', className)}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        onPointerEnter={(e) => { if (e.pointerType === 'mouse') show(); }}
                        onPointerLeave={(e) => { if (e.pointerType === 'mouse') hide(); }}
                        aria-label={`Campaign fit score ${fit.score ?? 'not available'}${fit.score != null ? '%' : ''}. Show breakdown`}
                        className="relative grid cursor-help place-items-center rounded-full bg-brand/10 outline-none"
                        style={{ width: size, height: size }}
                    >
                        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 -rotate-90" aria-hidden>
                            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-foreground/10" />
                            <circle
                                cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
                                strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)}
                                className="stroke-brand transition-[stroke-dashoffset] duration-700 ease-out"
                            />
                        </svg>
                        <span className="pointer-events-none relative flex items-start font-display font-bold leading-none tabular-nums">
                            <span style={{ fontSize: Math.round(size * 0.3) }}>{fit.score ?? '—'}</span>
                            {fit.score != null && <span className="mt-px" style={{ fontSize: Math.round(size * 0.18) }}>%</span>}
                        </span>
                    </button>
                </PopoverTrigger>
                <span className="whitespace-nowrap rounded-full bg-foreground px-1.5 py-px text-[8px] font-bold uppercase leading-tight tracking-[0.06em] text-brand">
                    Campaign fit
                </span>
            </span>
            <PopoverContent
                align="end"
                side="bottom"
                collisionPadding={12}
                onOpenAutoFocus={(e) => e.preventDefault()}
                // Closing must not hand focus back to the ring: that left a highlight box around it.
                onCloseAutoFocus={(e) => e.preventDefault()}
                onPointerEnter={show}
                onPointerLeave={hide}
                onClick={(e) => e.stopPropagation()}
                className="w-72 rounded-2xl p-4 shadow-float"
            >
                <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-sm font-semibold tracking-tight">Campaign fit score</p>
                    <p className="font-display text-lg font-bold tabular-nums">{fit.score != null ? `${fit.score}%` : '—'}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{fit.label} · {fit.confidence} confidence</p>
                <ul className="mt-3 space-y-2">
                    {fit.factors.map((factor) => (
                        <li key={factor.key} className="grid grid-cols-[1fr_88px_28px] items-center gap-2 text-xs">
                            <span className={factor.score == null ? 'text-muted-foreground' : 'text-foreground'}>{factor.label}</span>
                            <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden className="h-1.5 w-full overflow-hidden rounded-full">
                                <rect width="100" height="6" className="fill-foreground/10" />
                                {factor.score != null && <rect width={factor.score} height="6" className="fill-brand" />}
                            </svg>
                            <span className="text-right font-semibold tabular-nums text-muted-foreground">{factor.score ?? '—'}</span>
                        </li>
                    ))}
                </ul>
                <p className="mt-3 border-t border-dashed border-border pt-2.5 text-[11px] text-muted-foreground">
                    — no data yet, left out of the score.
                </p>
            </PopoverContent>
        </Popover>
    );
}
