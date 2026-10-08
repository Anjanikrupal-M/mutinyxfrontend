import { cn } from '@/lib/utils';

interface TextFieldProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    maxLength?: number;
    error?: string;
    prefix?: string;
    type?: string;
    disabled?: boolean;
    className?: string;
    inputClassName?: string;
}

export function TextField({
    label,
    value,
    onChange,
    onBlur,
    placeholder,
    maxLength,
    error,
    prefix,
    type = 'text',
    disabled,
    className,
    inputClassName,
}: TextFieldProps) {
    return (
        <div className={cn('space-y-1.5', className)}>
            {label && <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>}
            <div className="relative">
                {prefix && (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none">
                        {prefix}
                    </span>
                )}
                <input
                    type={type}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    className={cn(
                        'w-full h-10 px-4 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 transition-premium disabled:opacity-50',
                        prefix && 'pl-8',
                        error ? 'border-destructive' : 'border-border',
                        inputClassName
                    )}
                />
            </div>
            {(error || maxLength) && (
                <div className="flex items-center justify-between">
                    {error ? <p className="text-xs text-destructive">{error}</p> : <span />}
                    {maxLength && (
                        <span className="text-[11px] text-muted-foreground shrink-0">
                            {value.length}/{maxLength}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

interface TextAreaFieldProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    maxLength?: number;
    rows?: number;
    error?: string;
    /** Colors the char counter amber/red as the value approaches maxLength (used by fields with a soft minimum, e.g. script flow). */
    warnNearLimit?: boolean;
    minLength?: number;
    className?: string;
}

export function TextAreaField({
    label,
    value,
    onChange,
    placeholder,
    maxLength,
    rows = 4,
    error,
    warnNearLimit,
    minLength,
    className,
}: TextAreaFieldProps) {
    const trimmedLength = value.trim().length;
    const belowMin = minLength !== undefined && trimmedLength > 0 && trimmedLength < minLength;
    const nearLimit = warnNearLimit && maxLength ? value.length >= maxLength * 0.9 : false;

    return (
        <div className={cn('space-y-1.5', className)}>
            {label && <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>}
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                maxLength={maxLength}
                rows={rows}
                className={cn(
                    'w-full px-4 py-3 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/50 transition-premium',
                    error ? 'border-destructive' : 'border-border'
                )}
            />
            {(error || maxLength) && (
                <div className="flex items-center justify-between">
                    {error ? <p className="text-xs text-destructive">{error}</p> : <span />}
                    {maxLength && (
                        <span
                            className={cn(
                                'text-xs tabular-nums shrink-0',
                                belowMin ? 'text-destructive' : nearLimit ? 'text-amber-600 font-medium' : 'text-muted-foreground'
                            )}
                        >
                            {value.length}/{maxLength}
                            {minLength !== undefined ? ` chars (min ${minLength})` : ''}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
