import { cn } from '@/lib/utils';
import { HireManagerButton } from './HireManagerButton';
import { InfoTooltip } from './InfoTooltip';

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
    /** Small "i" next to the title explaining what the page/section is for. */
    infoTooltip?: string;
    /** Hide the global "Hire a Manager" action for pages where it doesn't belong. */
    hideHireManager?: boolean;
    /** Entrance animation: the title rises in, the info icon pops, the description slides in. Off by default. */
    animated?: boolean;
    /** 'lg' gives a larger, heavier title for hero-style headers. */
    size?: 'default' | 'lg';
}

export function PageHeader({ title, description, actions, className, infoTooltip, hideHireManager, animated, size = 'default' }: PageHeaderProps) {
    const titleClass = size === 'lg'
        ? 'text-[28px] sm:text-[32px] leading-tight font-extrabold font-display tracking-[-0.03em]'
        : 'text-xl sm:text-2xl font-bold font-display tracking-tight';
    return (
        <div className={cn('flex flex-col mb-6 gap-2', className)}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                    {animated ? (
                        <h1 className={cn('-mb-1.5 overflow-hidden pb-1.5', titleClass)}>
                            <span className="block animate-rise truncate">{title}</span>
                        </h1>
                    ) : (
                        <h1 className={cn('truncate', titleClass)}>{title}</h1>
                    )}
                    {/* Drops downward so it never renders up into the sticky nav. */}
                    {infoTooltip && (
                        <span className={cn('inline-flex', animated && 'animate-pop [animation-delay:450ms]')}>
                            <InfoTooltip text={infoTooltip} side="bottom" iconClassName="w-3.5 h-3.5" className="mt-0.5" />
                        </span>
                    )}
                </div>
                {/* Global "Hire a Manager" CTA sits inline, left of each page's own
                    actions; it renders null for users who aren't eligible. */}
                <div className="flex items-center gap-2 shrink-0">
                    {!hideHireManager && <HireManagerButton />}
                    {actions}
                </div>
            </div>
            {description && (
                <p className={cn(size === 'lg' ? 'text-[13px] text-muted-foreground' : 'text-sm text-muted-foreground', animated && 'animate-slide-in-left [animation-delay:200ms]')}>{description}</p>
            )}
        </div>
    );
}
