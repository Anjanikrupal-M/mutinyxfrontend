// ─────────────────────────────────────────────────────────────
// Bento-tile primitives — the tile look shared by the campaign
// builder and the dashboard (cards, choice pills,
// segmented switches, notes). Presentational only: every value
// and handler comes from the caller.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronDown, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// The one "selected" look shared by every choice in the flow: pale brand fill, dark outline.
export const selectedClass = 'border-foreground bg-brand/20 text-foreground';
export const idleClass = 'border-border bg-card text-foreground/80 hover:border-foreground hover:text-foreground';

/** Classes for any toggle (chip, key, tile). Callers add size, radius and padding. */
export const choiceClass = (selected: boolean) =>
    cn('border transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed', selected ? selectedClass : idleClass);

export const fieldClass =
    'w-full rounded-xl border bg-card px-4 text-sm text-foreground placeholder:text-foreground/45 transition-[border-color,box-shadow] focus:border-foreground focus:outline-none focus:ring-4 focus:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-60';

export const fieldBorder = (invalid: boolean) =>
    invalid ? 'border-destructive' : 'border-border hover:border-foreground/30';

// ── Tile ──

interface TileProps {
    icon: LucideIcon;
    title: string;
    description: string;
    required?: boolean;
    optional?: boolean;
    /** Shown at the right of the header, e.g. a counter, switch or "Locked" badge. */
    aside?: ReactNode;
    /** Makes the tile fold away; `summary` is what it shows while folded. */
    collapsible?: { summary: string; defaultOpen: boolean };
    /** Grid placement and entrance delay, e.g. "lg:col-span-6 [animation-delay:140ms]". */
    className?: string;
    /** Recolours the round icon in the header (grey by default), e.g. "bg-brand text-black". */
    iconClassName?: string;
    children?: ReactNode;
}

/**
 * One block of the builder's bento grid. While something inside has focus the card gets a soft
 * brand outline and a deeper shadow. No transform is used for the lift — that would trap
 * popovers behind later tiles.
 */
export function Tile({ icon: Icon, title, description, required, optional, aside, collapsible, className, iconClassName, children }: TileProps) {
    const [open, setOpen] = useState(collapsible ? collapsible.defaultOpen : true);

    const heading = (
        <>
            <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground', iconClassName)}>
                <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-display text-base font-semibold leading-5 tracking-tight">
                    {title}
                    {required && <span className="text-muted-foreground">*</span>}
                    {optional && (
                        <span className="ml-0.5 rounded-full bg-secondary px-2 py-0.5 font-sans text-[11px] font-medium tracking-normal text-muted-foreground">
                            Optional
                        </span>
                    )}
                </span>
                <span className="block truncate text-xs leading-[18px] text-muted-foreground">{description}</span>
            </span>
        </>
    );

    return (
        <section
            className={cn(
                'col-span-12 flex animate-fade-up flex-col rounded-3xl border border-border bg-card p-5 shadow-card ring-0 ring-brand/60 transition-[box-shadow,border-color] duration-300 focus-within:border-foreground/30 focus-within:shadow-float focus-within:ring-[3px]',
                className,
            )}
        >
            {collapsible ? (
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                    className="group flex w-full items-center gap-3 rounded-xl text-left outline-none"
                >
                    {heading}
                    {!open && (
                        <span className="hidden max-w-[46%] truncate rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/80 md:block">
                            {collapsible.summary}
                        </span>
                    )}
                    <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border pl-2.5 pr-2 text-xs font-medium transition-colors group-hover:border-foreground">
                        {open ? 'Hide' : 'Show'}
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-300', open && 'rotate-180')} />
                    </span>
                </button>
            ) : (
                <header className="flex items-center gap-3">
                    {heading}
                    {aside}
                </header>
            )}
            {open && children && (
                <div className={cn('mt-5 flex flex-1 flex-col gap-5', collapsible && 'animate-fade-up')}>{children}</div>
            )}
        </section>
    );
}

// ── Field ──

/**
 * Validation message. Rendered as `p.text-destructive` on purpose: the builder's
 * scrollToFirstValidationError finds errors by that selector.
 */
export function ErrorText({ message }: { message?: string | false }) {
    if (!message) return null;
    return (
        <p className="mt-2 flex animate-fade-up items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {message}
        </p>
    );
}

interface FieldProps {
    label: string;
    htmlFor?: string;
    required?: boolean;
    hint?: ReactNode;
    error?: string | false;
    className?: string;
    children: ReactNode;
}

export function Field({ label, htmlFor, required, hint, error, className, children }: FieldProps) {
    const labelContent = (
        <>
            {label}
            {required && <span className="ml-0.5 text-muted-foreground">*</span>}
        </>
    );
    return (
        <div data-invalid={Boolean(error)} className={className}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
                {htmlFor ? (
                    <label htmlFor={htmlFor} className="text-[13px] font-medium">{labelContent}</label>
                ) : (
                    <p className="text-[13px] font-medium">{labelContent}</p>
                )}
                {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
            </div>
            {children}
            <ErrorText message={error} />
        </div>
    );
}

/** Character counter placed inside a text field. */
export function Counter({ length, max, className }: { length: number; max: number; className: string }) {
    return (
        <span
            className={cn(
                'pointer-events-none absolute text-xs tabular-nums transition-colors',
                length >= max * 0.9 ? 'font-semibold text-foreground' : 'font-medium text-foreground/50',
                className,
            )}
        >
            {length}/{max}
        </span>
    );
}

// ── Choices ──

interface OptionCardProps {
    icon: LucideIcon;
    title: string;
    description: string;
    selected: boolean;
    disabled?: boolean;
    onSelect: () => void;
}

/** A larger choice with an icon and a line of explanation. */
export function OptionCard({ icon: Icon, title, description, selected, disabled, onSelect }: OptionCardProps) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={onSelect}
            className={cn('flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3.5 text-left disabled:opacity-50', choiceClass(selected))}
        >
            <span
                className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full text-foreground transition-colors duration-200',
                    selected ? 'bg-brand' : 'bg-secondary',
                )}
            >
                <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-[17px] text-foreground">{title}</span>
                <span className="block truncate text-[11px] leading-[15px] text-muted-foreground">{description}</span>
            </span>
        </button>
    );
}

// Literal class lookups so Tailwind's scanner can see every variant.
const SEGMENT_COLS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };
const THUMB_WIDTH: Record<number, string> = {
    2: 'w-[calc((100%-8px)/2)]',
    3: 'w-[calc((100%-8px)/3)]',
    4: 'w-[calc((100%-8px)/4)]',
};
const THUMB_OFFSET = ['translate-x-0', 'translate-x-full', 'translate-x-[200%]', 'translate-x-[300%]'];

interface SegmentedProps {
    label: string;
    options: { value: string; label?: string; icon?: LucideIcon }[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
}

/** One-of-many switch (2–4 options): the selected-style thumb glides to the chosen segment. */
export function Segmented({ label, options, value, onChange, disabled, className }: SegmentedProps) {
    const index = options.findIndex((o) => o.value === value);
    return (
        <div
            role="radiogroup"
            aria-label={label}
            aria-disabled={disabled}
            className={cn('relative grid rounded-full bg-secondary p-1', SEGMENT_COLS[options.length], disabled && 'opacity-60', className)}
        >
            {index >= 0 && (
                <span
                    aria-hidden
                    className={cn(
                        'absolute inset-y-1 left-1 rounded-full border border-foreground bg-card transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
                        THUMB_WIDTH[options.length],
                        THUMB_OFFSET[index],
                    )}
                >
                    <span className="absolute inset-0 rounded-full bg-brand/20" />
                </span>
            )}
            {options.map(({ value: option, label: text, icon: Icon }) => {
                const active = option === value;
                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={disabled}
                        onClick={() => onChange(option)}
                        className={cn(
                            'relative z-10 flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[13px] transition-colors duration-200 disabled:cursor-not-allowed',
                            active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {Icon && <Icon className="h-3.5 w-3.5" />}
                        {text ?? option}
                    </button>
                );
            })}
        </div>
    );
}

interface SummaryProps {
    summary: string;
    active: boolean;
    onClear?: () => void;
}

/** The current choice in words, with a Clear link once there is one. */
export function Summary({ summary, active, onClear }: SummaryProps) {
    return (
        <div className="flex shrink-0 items-center gap-2">
            {active && onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                    Clear
                </button>
            )}
            <span
                key={summary}
                className={cn(
                    'animate-pop rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums',
                    active ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground',
                )}
            >
                {summary}
            </span>
        </div>
    );
}

type PickerHeaderProps = SummaryProps & { label: string; hint?: string; required?: boolean };

/** Label on the left; the current choice and a Clear link on the right. */
export function PickerHeader({ label, hint, required, ...summary }: PickerHeaderProps) {
    return (
        <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium">
                {label}
                {required && <span className="ml-0.5 text-muted-foreground">*</span>}
                {hint && <span className="ml-2 font-normal text-muted-foreground">{hint}</span>}
            </p>
            <Summary {...summary} />
        </div>
    );
}

/** Grey explanation box; give it a changing `key` so it fades in again when its text changes. */
export function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warning' }) {
    return (
        <p
            className={cn(
                'flex min-h-10 animate-fade-up items-center gap-2 rounded-xl px-3 py-2 text-xs leading-[18px]',
                tone === 'warning' ? 'bg-warning/10 text-foreground' : 'bg-secondary text-foreground/80',
            )}
        >
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>{children}</span>
        </p>
    );
}

interface ConfirmProps {
    message: string;
    keepLabel: string;
    confirmLabel: string;
    onKeep: () => void;
    onConfirm: () => void;
}

/** Inline yes/no before a change that would throw away something already chosen or written. */
export function Confirm({ message, keepLabel, confirmLabel, onKeep, onConfirm }: ConfirmProps) {
    return (
        <div role="alert" className="flex animate-fade-up flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2 text-xs">
            <span>{message}</span>
            <span className="flex gap-1.5">
                <button
                    type="button"
                    onClick={onKeep}
                    className="h-7 rounded-full border border-border bg-card px-3 font-medium transition-colors hover:border-foreground"
                >
                    {keepLabel}
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    className="h-7 rounded-full bg-foreground px-3 font-semibold text-background transition-opacity hover:opacity-90"
                >
                    {confirmLabel}
                </button>
            </span>
        </div>
    );
}

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
                checked ? 'border-foreground bg-foreground' : 'border-border bg-muted',
            )}
        >
            <span
                className={cn(
                    'absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-background shadow-sm transition-transform duration-200',
                    checked && 'translate-x-5',
                )}
            />
        </button>
    );
}

/** Small "Locked" pill for sections a live campaign can no longer change. */
export function LockedBadge({ icon: Icon, label = 'Locked' }: { icon: LucideIcon; label?: string }) {
    return (
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <Icon className="h-3 w-3" />
            {label}
        </span>
    );
}

/**
 * Placeholder that types and erases each example in turn. Static while `enabled` is false
 * (e.g. the field has a value) or when the user prefers reduced motion.
 */
export function useTypingPlaceholder(examples: string[], enabled: boolean) {
    const [placeholder, setPlaceholder] = useState(`e.g. ${examples[0]}`);

    useEffect(() => {
        if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let example = 0;
        let chars = 0;
        let erasing = false;
        let timer: ReturnType<typeof setTimeout>;

        const tick = () => {
            const full = examples[example];
            chars += erasing ? -1 : 1;
            setPlaceholder(`e.g. ${full.slice(0, chars)}|`);
            if (!erasing && chars === full.length) {
                erasing = true;
                timer = setTimeout(tick, 1600); // hold the finished example
            } else if (erasing && chars === 0) {
                erasing = false;
                example = (example + 1) % examples.length;
                timer = setTimeout(tick, 350);
            } else {
                timer = setTimeout(tick, erasing ? 35 : 75);
            }
        };
        // Starts after the page's entrance animations, so they don't all move at once.
        timer = setTimeout(tick, 2200);
        return () => clearTimeout(timer);
    }, [examples, enabled]);

    return placeholder;
}

/** Ring that fills as the current step's required items are completed. */
export function ProgressRing({ done, total }: { done: number; total: number }) {
    const circumference = 2 * Math.PI * 9;
    const ratio = total > 0 ? done / total : 1;
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 -rotate-90" aria-hidden>
            <circle cx="12" cy="12" r="9" fill="none" strokeWidth="3" className="stroke-border" />
            <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - ratio)}
                className="stroke-foreground transition-[stroke-dashoffset] duration-500 ease-out"
            />
        </svg>
    );
}
