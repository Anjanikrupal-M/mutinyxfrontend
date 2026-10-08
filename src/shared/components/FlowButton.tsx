import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    /** Shows a spinner and `loadingText`, and blocks clicks. */
    loading?: boolean;
    loadingText?: ReactNode;
}

// Timing written as arbitrary properties: Tailwind reads the ease/duration bracket shorthands
// as ambiguous (tailwindcss-animate defines its own ease and duration utilities) and may drop them.
const EASE_OUT_QUINT = '[transition-timing-function:cubic-bezier(0.23,1,0.32,1)]';
const EASE_BACK = '[transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]';

/**
 * Brand-yellow call-to-action with a "flow" hover: the colour never changes (yellow with black
 * text); the right arrow flies out while a second one flies in from the left and the label
 * slides across. The pill shape never changes. Disabled and loading
 * states render the same shape without the hover motion.
 *
 * Shared because any page can use it as its primary action (first used by the Influencers
 * page's "Ask AI" box). Pass sizing/layout through `className`, e.g. "h-12 w-full sm:w-auto".
 */
export function FlowButton({ children, loading = false, loadingText, disabled, className, type = 'button', ...props }: FlowButtonProps) {
    const inactive = disabled || loading;

    if (inactive) {
        return (
            <button
                type={type}
                disabled
                className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-full px-8 text-sm font-bold',
                    loading
                        ? 'cursor-wait bg-brand text-black'
                        : 'cursor-not-allowed bg-secondary text-muted-foreground',
                    className,
                )}
                {...props}
            >
                {loading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {loadingText ?? children}
                    </>
                ) : (
                    <>
                        {children}
                        <ArrowRight className="h-4 w-4" />
                    </>
                )}
            </button>
        );
    }

    return (
        <button
            type={type}
            className={cn(
                'group/flow relative inline-flex items-center justify-center gap-1 overflow-hidden rounded-full bg-brand px-8 text-sm font-bold text-black',
                'shadow-[0_6px_20px_-6px_rgb(250_203_3_/_0.9)] transition-all [transition-duration:600ms] active:scale-[0.95]',
                EASE_OUT_QUINT,
                className,
            )}
            {...props}
        >
            {/* Arrow that flies in from the left on hover */}
            <ArrowRight
                aria-hidden
                className={cn(
                    'absolute left-[-25%] z-[9] h-4 w-4 transition-all [transition-duration:800ms] group-hover/flow:left-4',
                    EASE_BACK,
                )}
            />

            {/* Label: shifts right to make room for the incoming arrow */}
            <span className="relative z-[1] -translate-x-3 transition-all [transition-duration:800ms] ease-out group-hover/flow:translate-x-3">
                {children}
            </span>

            {/* Arrow that flies out to the right on hover */}
            <ArrowRight
                aria-hidden
                className={cn(
                    'absolute right-4 z-[9] h-4 w-4 transition-all [transition-duration:800ms] group-hover/flow:right-[-25%]',
                    EASE_BACK,
                )}
            />
        </button>
    );
}
