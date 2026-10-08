import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

type Tint = 'brand' | 'blue' | 'violet' | 'emerald';

const TINTS: Record<Tint, { bg: string; icon: string; glow: string }> = {
    brand: { bg: 'bg-[#fedc03]/10 border-[#fedc03]/20', icon: 'text-[#0a0a0a] group-hover:text-[#fedc03]', glow: 'bg-[#fedc03]/8 group-hover:bg-[#fedc03]/14' },
    blue: { bg: 'bg-blue-500/10 border-blue-500/20', icon: 'text-blue-600 group-hover:text-blue-500', glow: 'bg-blue-500/8 group-hover:bg-blue-500/14' },
    violet: { bg: 'bg-violet-500/10 border-violet-500/20', icon: 'text-violet-600 group-hover:text-violet-500', glow: 'bg-violet-500/8 group-hover:bg-violet-500/14' },
    emerald: { bg: 'bg-emerald-500/10 border-emerald-500/20', icon: 'text-emerald-600 group-hover:text-emerald-500', glow: 'bg-emerald-500/8 group-hover:bg-emerald-500/14' },
};

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    valuePrefix?: string;
    trend?: { value: number; positive: boolean };
    tint?: Tint;
    /** 'default' for hero stat rows (Dashboard); 'compact' for denser in-page grids (e.g. Analytics tabs). */
    size?: 'default' | 'compact';
    className?: string;
}

export function StatCard({ icon: Icon, label, value, valuePrefix, trend, tint = 'brand', size = 'default', className }: StatCardProps) {
    const palette = TINTS[tint];
    const compact = size === 'compact';

    return (
        <div className={cn(
            'relative overflow-hidden bg-card border border-border rounded-2xl flex flex-col group hover-lift',
            compact ? 'p-3.5' : 'p-5',
            className
        )}>
            {/* Subtle background glow on hover */}
            {!compact && (
                <div className={cn('absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full blur-3xl transition-colors duration-500', palette.glow)} />
            )}

            <div className={cn('relative z-10 flex items-start justify-between gap-2', compact ? 'mb-2.5' : 'mb-4')}>
                <div className={cn(
                    'rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-sm',
                    compact ? 'w-8 h-8' : 'w-11 h-11',
                    palette.bg
                )}>
                    <Icon className={cn(compact ? 'w-4 h-4' : 'w-5 h-5', 'transition-colors duration-300', palette.icon)} />
                </div>
                {trend && (
                    <span
                        className={cn(
                            'text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm border',
                            trend.positive
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        )}
                    >
                        {trend.positive ? '+' : ''}{trend.value}%
                    </span>
                )}
            </div>

            <div className="relative z-10 mt-auto">
                <p className={cn(
                    'font-black font-display tracking-tight text-foreground flex items-baseline gap-0.5 tabular-nums',
                    compact ? 'text-xl' : 'text-3xl'
                )}>
                    {valuePrefix && <span className={cn('font-bold text-foreground/70', compact ? 'text-sm' : 'text-xl')}>{valuePrefix}</span>}
                    {value}
                </p>
                <p className={cn('font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors', compact ? 'text-xs mt-0.5' : 'text-sm mt-1')}>{label}</p>
            </div>
        </div>
    );
}

