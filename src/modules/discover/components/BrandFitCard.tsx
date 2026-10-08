import { Check, MapPin, Sparkles, Tag, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandFitRing } from '@/shared/components/BrandFitRing';
import { brandFitClasses, type BrandFitResult } from '@/shared/utils/brandFit';

/** Each part is coloured by how much of its own weight it earned, not by the overall band. */
function partTone(ratio: number) {
    if (ratio >= 0.8) return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' };
    if (ratio >= 0.5) return { bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' };
    if (ratio >= 0.25) return { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' };
    return { bar: 'bg-rose-400', text: 'text-rose-600 dark:text-rose-400' };
}

const boxClass = 'rounded-2xl border border-border/70 bg-secondary/30';

/**
 * Brand Fit for the signed-in brand, with the three parts it is built from. Same client-side
 * score as the Discover cards and the Applications tab, so the number matches everywhere.
 */
export function BrandFitCard({ fit, className }: { fit: BrandFitResult | null; className?: string }) {
    if (!fit) {
        return (
            /* items-center, not items-start: this card is stretched to the hero row's height,
               so an unscored state would otherwise sit at the top of a tall empty box. */
            <div className={cn(boxClass, 'p-4 flex items-center gap-3', className)}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground">
                    <Sparkles className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                    <p className="text-sm font-semibold">Brand Fit</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                        Add your brand’s category and city in your profile to see how well this creator matches you.
                    </p>
                </div>
            </div>
        );
    }

    const style = brandFitClasses(fit.band);
    const parts = [
        { key: 'category', label: 'Category', icon: Tag, ...fit.reasons.category },
        { key: 'location', label: 'Location', icon: MapPin, ...fit.reasons.location },
        { key: 'quality', label: 'Engagement', icon: TrendingUp, ...fit.reasons.quality, matched: fit.reasons.quality.score >= fit.reasons.quality.max * 0.8 },
    ];

    return (
        <div className={cn(boxClass, 'p-4 flex flex-col', className)}>
            <div className="flex flex-col items-center text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Brand Fit score</p>
                <BrandFitRing fit={fit} size={88} showTag={false} className="mt-2.5" />
                <p className={cn('mt-2 font-display text-base font-semibold tracking-tight leading-tight', style.text)}>{fit.label}</p>
            </div>

            {/* Grows to fill whatever height the hero row gives it, spreading the slack evenly
                between the three reasons. Without this the card would either end short of the
                profile card beside it, or stretch and leave one dead gap at the bottom. */}
            <ul className="mt-3.5 flex flex-1 flex-col justify-evenly gap-3 border-t border-border/60 pt-3.5">
                {parts.map((part) => {
                    const ratio = part.max > 0 ? part.score / part.max : 0;
                    const tone = partTone(ratio);
                    return (
                        <li key={part.key} className="min-w-0" title={part.note}>
                            <div className="flex items-center gap-2 text-xs">
                                <part.icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                <span className="font-medium">{part.label}</span>
                                {part.matched && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-label="Matched" />}
                                <span
                                    className={cn('ml-auto shrink-0 font-semibold tabular-nums', tone.text)}
                                    title={`${part.score} of ${part.max} points`}
                                >
                                    {Math.round(ratio * 100)}%
                                </span>
                            </div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div className={cn('h-full rounded-full transition-[width] duration-700', tone.bar)} style={{ width: `${Math.max(ratio * 100, 3)}%` }} />
                            </div>
                            {/* Two lines, always. The note is one line for "Different location"
                                and two for "Niche \"Fashion & Beauty\" matches Fashion & Beauty",
                                so without a reserved height the whole card changed height from
                                one creator's profile to the next. */}
                            <p className="mt-1 line-clamp-2 min-h-[30px] text-[11px] leading-snug text-muted-foreground" title={part.note}>{part.note}</p>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
