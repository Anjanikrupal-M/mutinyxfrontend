import { cn } from '@/lib/utils';

interface PillOption {
    value: string;
    label: string;
}

interface PillPickerProps {
    options: PillOption[];
    selected: string;
    onSelect: (value: string) => void;
    disabled?: boolean;
    className?: string;
}

export function PillPicker({ options, selected, onSelect, disabled, className }: PillPickerProps) {
    return (
        <div className={cn('flex flex-wrap gap-2', className)}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(opt.value)}
                    className={cn(
                        'px-3.5 py-2 rounded-full border text-sm font-medium transition-premium',
                        selected === opt.value
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                        disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
