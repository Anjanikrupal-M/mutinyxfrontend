import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
    text: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    className?: string;
    iconClassName?: string;
}

/** Small "i" icon that shows an explanatory tooltip on hover/focus. Safe to use inside
 *  clickable cards/links/fields — the click is stopped so it never triggers the parent.
 *  The tooltip is viewport-clamped and collision-aware so it never spills over the nav. */
export function InfoTooltip({ text, side = 'top', className, iconClassName }: InfoTooltipProps) {
    return (
        <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    className={cn(
                        'inline-flex items-center justify-center shrink-0 rounded-full text-muted-foreground/50 hover:text-foreground focus-visible:text-foreground outline-none transition-colors cursor-help',
                        className
                    )}
                    aria-label="More info"
                >
                    <Info className={cn('w-3 h-3', iconClassName)} />
                </button>
            </TooltipTrigger>
            <TooltipContent
                side={side}
                collisionPadding={12}
                className="max-w-[min(240px,calc(100vw-2rem))] text-[11px] leading-relaxed"
            >
                {text}
            </TooltipContent>
        </Tooltip>
    );
}
