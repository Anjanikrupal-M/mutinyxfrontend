import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldBorder, fieldClass } from '@/shared/components/BentoUi';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Dates are kept as yyyy-mm-dd strings, the same as a native date input.
const pad = (n: number) => String(n).padStart(2, '0');
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromValue = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
};

interface BuilderDatePickerProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    invalid?: boolean;
    disabled?: boolean;
    /** Which edge the calendar lines up with, so it doesn't run off the screen. */
    align?: 'left' | 'right';
    /** Earliest pickable date (yyyy-mm-dd). Today when omitted. */
    min?: string;
}

/** Date field with a calendar in the builder's style. Days before `min` can't be picked. */
export function BuilderDatePicker({ id, value, onChange, invalid = false, disabled, align = 'left', min }: BuilderDatePickerProps) {
    const [open, setOpen] = useState(false);
    // Opens upwards when there isn't room for the calendar below the field.
    const [above, setAbove] = useState(false);
    const today = toValue(new Date());
    const earliest = min || today;
    const [month, setMonth] = useState(() => {
        const start = value ? fromValue(value) : fromValue(earliest);
        return new Date(start.getFullYear(), start.getMonth(), 1);
    });
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const toggle = () => {
        if (!open) {
            // Reopen on the chosen date's month.
            const d = value ? fromValue(value) : fromValue(earliest);
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            const rect = ref.current!.getBoundingClientRect();
            setAbove(window.innerHeight - rect.bottom < 400 && rect.top > 400);
        }
        setOpen(!open);
    };
    const pick = (next: string) => {
        onChange(next);
        setOpen(false);
    };

    const earliestMonth = fromValue(earliest);
    const atEarliestMonth =
        month.getFullYear() === earliestMonth.getFullYear() && month.getMonth() === earliestMonth.getMonth();
    // Six full weeks, starting on the Sunday on or before the 1st.
    const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));

    const label = value
        ? fromValue(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Pick a date';

    return (
        <div ref={ref} className="relative">
            <button
                id={id}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                disabled={disabled}
                onClick={toggle}
                className={cn(
                    fieldClass,
                    fieldBorder(invalid),
                    'flex h-11 items-center justify-between gap-2 text-left',
                    open && 'border-foreground ring-4 ring-foreground/10',
                )}
            >
                <span className={value ? 'font-medium' : 'text-muted-foreground/70'}>{label}</span>
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Choose a date"
                    className={cn(
                        'absolute z-50 w-[284px] animate-fade-up rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-float [animation-duration:160ms]',
                        above ? 'bottom-full mb-2' : 'top-full mt-2',
                        align === 'right' ? 'right-0' : 'left-0',
                    )}
                >
                    <div className="flex items-center justify-between px-1 pb-2">
                        <p className="font-display text-[15px] font-semibold tracking-tight">
                            {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </p>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                aria-label="Previous month"
                                disabled={atEarliestMonth}
                                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                                className="grid h-8 w-8 place-items-center rounded-full border border-border transition-colors enabled:hover:border-foreground disabled:text-muted-foreground/40"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                aria-label="Next month"
                                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                                className="grid h-8 w-8 place-items-center rounded-full border border-border transition-colors hover:border-foreground"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {WEEKDAYS.map((day) => (
                            <span key={day} className="py-1.5">{day}</span>
                        ))}
                    </div>

                    <div key={toValue(month)} className="grid animate-fade-up grid-cols-7 gap-0.5 [animation-duration:200ms]">
                        {days.map((day) => {
                            const dayValue = toValue(day);
                            const inMonth = day.getMonth() === month.getMonth();
                            const selected = dayValue === value;
                            const isToday = dayValue === today;
                            const tooEarly = dayValue < earliest;
                            return (
                                <button
                                    key={dayValue}
                                    type="button"
                                    disabled={tooEarly}
                                    aria-pressed={selected}
                                    aria-label={day.toDateString()}
                                    onClick={() => pick(dayValue)}
                                    className={cn(
                                        'relative grid h-9 place-items-center rounded-full text-[13px] tabular-nums transition-all duration-150 active:scale-90',
                                        selected
                                            ? 'bg-foreground font-semibold text-background ring-2 ring-brand ring-offset-2 ring-offset-popover'
                                            : tooEarly
                                                ? 'text-muted-foreground/40'
                                                : inMonth
                                                    ? 'font-medium text-foreground hover:bg-brand/30'
                                                    : 'text-muted-foreground hover:bg-secondary',
                                    )}
                                >
                                    {day.getDate()}
                                    {/* Today: a small brand dot under the number. */}
                                    {isToday && !selected && (
                                        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand ring-1 ring-foreground/20" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-border px-1 pt-2.5">
                        <button
                            type="button"
                            disabled={!value}
                            onClick={() => pick('')}
                            className="h-8 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors enabled:hover:bg-secondary enabled:hover:text-foreground disabled:opacity-40"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            disabled={today < earliest}
                            onClick={() => pick(today)}
                            className="h-8 rounded-full bg-foreground px-3.5 text-xs font-semibold text-background transition-opacity enabled:hover:opacity-90 disabled:opacity-40"
                        >
                            Today
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
