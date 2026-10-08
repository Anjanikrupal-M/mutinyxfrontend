import { cn } from '@/lib/utils';
import { brandFitClasses, type BrandFitResult } from '@/shared/utils/brandFit';

interface BrandFitRingProps {
    fit: BrandFitResult;
    /** Outer diameter in px. */
    size?: number;
    /** Show the "Brand Fit score" tag under the ring. Off only where the score is already titled. */
    showTag?: boolean;
    /** Tag text; defaults to "Brand Fit score". */
    tagLabel?: string;
    /** Extra hover text explaining what the score measures. */
    hint?: string;
    className?: string;
}

/** Circular (pie-style) Brand Fit score — the arc fills to the score, number in the centre. */
export function BrandFitRing({ fit, size = 56, showTag = true, tagLabel = 'Brand Fit score', hint, className }: BrandFitRingProps) {
    const style = brandFitClasses(fit.band);
    const strokeWidth = size >= 64 ? 4.5 : 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const score = Math.round(Math.max(0, Math.min(100, fit.score)));

    return (
        <div
            className={cn('shrink-0 flex flex-col items-center gap-1', className)}
            title={`${tagLabel}: ${score}% · ${fit.label}${hint ? ` — ${hint}` : ''}`}
            aria-label={`Brand Fit score ${score}%`}
        >
            <div
                className={cn('relative flex items-center justify-center rounded-full', style.bg)}
                style={{ width: size, height: size }}
            >
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        className="stroke-black/[0.06]"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - score / 100)}
                        className={cn('transition-[stroke-dashoffset] duration-700 ease-out', style.stroke)}
                    />
                </svg>
                <span className={cn('relative flex items-start leading-none font-display font-bold tabular-nums', style.text)}>
                    <span style={{ fontSize: Math.round(size * 0.32) }}>{score}</span>
                    <span className="mt-px" style={{ fontSize: Math.round(size * 0.19) }}>%</span>
                </span>
            </div>
            {showTag && (
                <span className={cn('whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-semibold uppercase leading-tight tracking-[0.04em]', style.bg, style.text)}>
                    {tagLabel}
                </span>
            )}
        </div>
    );
}
