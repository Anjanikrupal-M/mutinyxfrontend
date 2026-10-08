import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectorCardProps {
    icon?: LucideIcon;
    label: string;
    description?: string;
    selected: boolean;
    onClick: () => void;
    /** 'radio' inverts the icon tile when selected (single-select fields); 'checkbox' shows a corner check badge (multi-select fields). */
    variant?: 'radio' | 'checkbox';
    disabled?: boolean;
    /** Optional overlay node (e.g. a "Locked" badge) rendered top-right, replacing the checkbox badge slot. */
    badge?: React.ReactNode;
    className?: string;
}

export function SelectorCard({
    icon: Icon,
    label,
    description,
    selected,
    onClick,
    variant = 'radio',
    disabled,
    badge,
    className,
}: SelectorCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'relative flex items-start gap-3 p-3 rounded-xl border text-left transition-premium',
                selected ? 'border-foreground bg-secondary/50' : 'border-border hover:bg-secondary/30',
                disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
                className
            )}
        >
            {Icon && (
                <div
                    className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-premium',
                        variant === 'radio' && selected ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground'
                    )}
                >
                    <Icon className="w-5 h-5" />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{label}</p>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            {badge}
            {!badge && variant === 'checkbox' && selected && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-foreground flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-background" />
                </div>
            )}
        </button>
    );
}
