// ─────────────────────────────────────────────────────────────
// Audience pickers for builder step 1: an age line you can click
// or sweep across, and language keys shown in their own script.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { TARGET_AGE_RANGES, TARGET_LANGUAGES } from '@/shared/constants/audience';
import { PickerHeader, choiceClass } from '@/shared/components/BentoUi';

const AGE_GROUPS: readonly string[] = TARGET_AGE_RANGES;

const AGE_QUICK_PICKS = [
    { label: 'Youth', ages: ['13-17', '18-24'] },
    { label: 'Young adults', ages: ['25-34'] },
    { label: 'Adults', ages: ['35-44', '45-54'] },
    { label: '55+', ages: ['55-64', '65+'] },
];

const inBracketOrder = (ages: string[]) => AGE_GROUPS.filter((age) => ages.includes(age));

/** "18–34, 45–54" style summary: neighbouring brackets merge into one span. */
export function summarizeAges(ages: string[]) {
    const picked = AGE_GROUPS.map((age, i) => (ages.includes(age) ? i : -1)).filter((i) => i >= 0);
    if (picked.length === 0) return 'Any age';
    if (picked.length === AGE_GROUPS.length) return 'All ages';

    const span = (from: number, to: number) => {
        const start = AGE_GROUPS[from].split('-')[0].replace('+', '');
        const end = AGE_GROUPS[to];
        return end.endsWith('+') ? `${start}+` : `${start}–${end.split('-')[1]}`;
    };
    const spans: string[] = [];
    let from = picked[0];
    let to = picked[0];
    for (const i of picked.slice(1)) {
        if (i === to + 1) {
            to = i;
        } else {
            spans.push(span(from, to));
            from = to = i;
        }
    }
    spans.push(span(from, to));
    return spans.join(', ');
}

interface AgeLineProps {
    value: string[];
    onChange: (ages: string[]) => void;
    className?: string;
}

/**
 * Age picker drawn as a line with one stop per bracket. A stop grows into a bead when selected
 * and neighbouring beads join up. Click a stop to toggle it, or press and sweep across several.
 */
export function AgeLine({ value, onChange, className }: AgeLineProps) {
    // While the pointer is held down: true = selecting, false = clearing.
    const painting = useRef<boolean | null>(null);

    useEffect(() => {
        const stop = () => {
            painting.current = null;
        };
        window.addEventListener('pointerup', stop);
        return () => window.removeEventListener('pointerup', stop);
    }, []);

    const setBracket = (age: string, on: boolean) => {
        if (value.includes(age) === on) return;
        onChange(inBracketOrder(on ? [...value, age] : value.filter((a) => a !== age)));
    };

    return (
        <div className={className}>
            <PickerHeader label="Age range" summary={summarizeAges(value)} active={value.length > 0} onClear={() => onChange([])} />

            <div role="group" aria-label="Audience age brackets" className="flex select-none">
                {AGE_GROUPS.map((age, i) => {
                    const selected = value.includes(age);
                    const joinsPrevious = selected && value.includes(AGE_GROUPS[i - 1]);
                    const joinsNext = selected && value.includes(AGE_GROUPS[i + 1]);
                    return (
                        <button
                            key={age}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`Ages ${age}`}
                            onPointerDown={(e) => {
                                // Let the pointer reach the other stops while it is held down.
                                if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                                painting.current = !selected;
                                setBracket(age, !selected);
                            }}
                            onPointerEnter={() => painting.current !== null && setBracket(age, painting.current)}
                            // Pointer presses are handled above; this only catches Enter / Space.
                            onClick={(e) => e.detail === 0 && setBracket(age, !selected)}
                            className="group relative flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-full pb-0.5 pt-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                        >
                            <span className="relative grid h-8 w-full place-items-center">
                                {/* The line: a thin rail between stops, thick where two chosen stops meet. */}
                                {i > 0 && (
                                    <span
                                        className={cn(
                                            'absolute left-0 right-1/2 top-1/2 -translate-y-1/2 transition-all duration-300',
                                            joinsPrevious ? 'h-1 bg-foreground' : 'h-0.5 bg-border',
                                        )}
                                    />
                                )}
                                {i < AGE_GROUPS.length - 1 && (
                                    <span
                                        className={cn(
                                            'absolute left-1/2 right-0 top-1/2 -translate-y-1/2 transition-all duration-300',
                                            joinsNext ? 'h-1 bg-foreground' : 'h-0.5 bg-border',
                                        )}
                                    />
                                )}
                                {/* The stop: a hollow dot that grows into a dark bead with a brand core. */}
                                <span
                                    className={cn(
                                        'relative grid place-items-center rounded-full transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]',
                                        selected
                                            ? 'h-[18px] w-[18px] bg-foreground ring-[1.5px] ring-brand ring-offset-2 ring-offset-card'
                                            : 'h-3.5 w-3.5 border-2 border-muted-foreground/40 bg-card group-hover:h-4 group-hover:w-4 group-hover:border-foreground',
                                    )}
                                >
                                    <span className={cn('rounded-full bg-brand transition-all duration-300', selected ? 'h-1.5 w-1.5' : 'h-0 w-0')} />
                                </span>
                            </span>
                            <span
                                className={cn(
                                    'text-[11px] tabular-nums transition-colors',
                                    selected ? 'font-semibold text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                                )}
                            >
                                {age.replace('-', '–')}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="mr-0.5 text-muted-foreground">Quick pick</span>
                {AGE_QUICK_PICKS.map(({ label, ages }) => {
                    const active = ages.every((age) => value.includes(age));
                    return (
                        <button
                            key={label}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onChange(inBracketOrder(active ? value.filter((a) => !ages.includes(a)) : [...value, ...ages]))}
                            className={cn('h-6 rounded-full px-2 font-medium', choiceClass(active))}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// Each language written in its own script; falls back to the name's first letters.
const LANGUAGE_SCRIPTS: Record<string, string> = {
    English: 'Aa',
    Hindi: 'हिन्दी',
    Telugu: 'తెలుగు',
    Tamil: 'தமிழ்',
    Kannada: 'ಕನ್ನಡ',
    Malayalam: 'മലയാളം',
    Marathi: 'मराठी',
    Bengali: 'বাংলা',
    Gujarati: 'ગુજરાતી',
    Punjabi: 'ਪੰਜਾਬੀ',
    Odia: 'ଓଡ଼ିଆ',
    Assamese: 'অসমীয়া',
    Urdu: 'اردو',
    Konkani: 'कोंकणी',
    Bhojpuri: 'भोजपुरी',
};

interface LanguageKeysProps {
    value: string[];
    onChange: (value: string[]) => void;
    className?: string;
}

/** Language picker as a set of keys, each showing the language in its own script. */
export function LanguageKeys({ value, onChange, className }: LanguageKeysProps) {
    const summary = value.length === 0 ? 'Any language' : value.length === 1 ? value[0] : `${value.length} languages`;

    return (
        <div className={className}>
            <PickerHeader
                label="Language"
                hint="What their followers speak"
                summary={summary}
                active={value.length > 0}
                onClear={() => onChange([])}
            />
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {TARGET_LANGUAGES.map((name) => {
                    const selected = value.includes(name);
                    return (
                        <button
                            key={name}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChange(selected ? value.filter((l) => l !== name) : [...value, name])}
                            className={cn('flex h-[52px] flex-col items-center justify-center rounded-xl', choiceClass(selected))}
                        >
                            <span className="text-sm font-semibold leading-5 text-foreground">{LANGUAGE_SCRIPTS[name] ?? name.slice(0, 2)}</span>
                            <span className="text-[11px] leading-[14px] text-muted-foreground">{name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
