// ─────────────────────────────────────────────────────────────
// City picker for builder step 1: region tabs with that region's
// cities underneath. Labels are what brands see; `city`/`state`
// are the exact names in shared/constants/locations (country-state-city),
// so picks round-trip with the rest of the app.
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ErrorText, PickerHeader, choiceClass } from '@/shared/components/BentoUi';

export interface BoardCity {
    label: string;
    city: string;
    state: string;
}

// The cities on offer, grouped the way people think about the map.
export const CITY_REGIONS: { region: string; cities: BoardCity[] }[] = [
    {
        region: 'North',
        cities: [
            { label: 'Delhi', city: 'Delhi', state: 'Delhi' },
            { label: 'Chandigarh', city: 'Chandigarh', state: 'Chandigarh' },
            { label: 'Jaipur', city: 'Jaipur', state: 'Rajasthan' },
            { label: 'Lucknow', city: 'Lucknow', state: 'Uttar Pradesh' },
        ],
    },
    {
        region: 'West',
        cities: [
            { label: 'Mumbai', city: 'Mumbai', state: 'Maharashtra' },
            { label: 'Pune', city: 'Pune', state: 'Maharashtra' },
            { label: 'Ahmedabad', city: 'Ahmedabad', state: 'Gujarat' },
            { label: 'Surat', city: 'Surat', state: 'Gujarat' },
        ],
    },
    {
        region: 'South',
        cities: [
            { label: 'Bengaluru', city: 'Bengaluru', state: 'Karnataka' },
            { label: 'Hyderabad', city: 'Hyderabad', state: 'Telangana' },
            { label: 'Chennai', city: 'Chennai', state: 'Tamil Nadu' },
            // Stored as "Cochin" in the location data.
            { label: 'Kochi', city: 'Cochin', state: 'Kerala' },
            { label: 'Coimbatore', city: 'Coimbatore', state: 'Tamil Nadu' },
            { label: 'Vijayawada', city: 'Vijayawada', state: 'Andhra Pradesh' },
            { label: 'Visakhapatnam', city: 'Visakhapatnam', state: 'Andhra Pradesh' },
        ],
    },
    {
        region: 'East',
        cities: [
            { label: 'Kolkata', city: 'Kolkata', state: 'West Bengal' },
            { label: 'Patna', city: 'Patna', state: 'Bihar' },
            { label: 'Guwahati', city: 'Guwahati', state: 'Assam' },
        ],
    },
    {
        region: 'Central',
        cities: [
            { label: 'Bhopal', city: 'Bhopal', state: 'Madhya Pradesh' },
            { label: 'Indore', city: 'Indore', state: 'Madhya Pradesh' },
            { label: 'Nagpur', city: 'Nagpur', state: 'Maharashtra' },
        ],
    },
];

export const BOARD_CITIES = CITY_REGIONS.flatMap(({ cities }) => cities);

interface CityBoardProps {
    label: string;
    hint?: string;
    required?: boolean;
    emptySummary: string;
    /** Picked values; may also hold values from outside the board (kept untouched). */
    value: string[];
    onChange: (value: string[]) => void;
    /** How a board city is stored in `value`, e.g. "Pune" or "Pune, Maharashtra". */
    toValue: (city: BoardCity) => string;
    /** Turns a stored value back into a display label. */
    toLabel?: (value: string) => string;
    error?: string | false;
    disabled?: boolean;
    className?: string;
}

/**
 * Compact city picker: a row of region tabs, with the chosen region's cities underneath.
 * Click a city to toggle it, or "Select all" to take the whole region.
 */
export function CityBoard({
    label,
    hint,
    required,
    emptySummary,
    value,
    onChange,
    toValue,
    toLabel = (v) => v,
    error,
    disabled,
    className,
}: CityBoardProps) {
    const toggleCity = (v: string) => onChange(value.includes(v) ? value.filter((c) => c !== v) : [...value, v]);

    const summary = value.length === 0 ? emptySummary : value.length === 1 ? toLabel(value[0]) : `${value.length} cities`;

    // Open on the first region that already has a pick, so restored choices are visible straight away.
    const [region, setRegion] = useState(
        () => CITY_REGIONS.find(({ cities }) => cities.some((c) => value.includes(toValue(c))))?.region ?? CITY_REGIONS[0].region,
    );
    const regionValues = CITY_REGIONS.find((r) => r.region === region)!.cities.map(toValue);
    const allInRegion = regionValues.every((v) => value.includes(v));

    return (
        <div data-invalid={Boolean(error)} className={className}>
            <PickerHeader
                label={label}
                hint={hint}
                required={required}
                summary={summary}
                active={value.length > 0}
                onClear={disabled ? undefined : () => onChange([])}
            />
            <div className={cn('rounded-xl border bg-secondary/50 p-1.5', error ? 'border-destructive/50' : 'border-border', disabled && 'pointer-events-none opacity-60')}>
                {/* Region tabs; a tab's badge counts the cities already picked there. */}
                <div role="tablist" aria-label={`${label} regions`} className="flex flex-wrap items-center gap-1">
                    {CITY_REGIONS.map(({ region: name, cities }) => {
                        const count = cities.filter((c) => value.includes(toValue(c))).length;
                        const active = name === region;
                        return (
                            <button
                                key={name}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setRegion(name)}
                                className={cn(
                                    'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition-all duration-200',
                                    active
                                        ? 'bg-card font-semibold text-foreground shadow-sm ring-1 ring-foreground/[0.06]'
                                        : 'font-medium text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {name}
                                {count > 0 && (
                                    <span
                                        key={count}
                                        className="grid h-4 min-w-4 animate-pop place-items-center rounded-full bg-foreground px-1 text-[10px] font-semibold tabular-nums text-background"
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        aria-pressed={allInRegion}
                        onClick={() =>
                            onChange(allInRegion ? value.filter((v) => !regionValues.includes(v)) : [...new Set([...value, ...regionValues])])
                        }
                        className="ml-auto h-8 rounded-full px-2.5 text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    >
                        {allInRegion ? `Remove all ${region}` : `Select all ${region}`}
                    </button>
                </div>

                <div key={region} role="tabpanel" className="flex animate-fade-up flex-wrap gap-1.5 px-1.5 pb-1.5 pt-2 [animation-duration:200ms]">
                    {CITY_REGIONS.find((r) => r.region === region)!.cities.map((c) => {
                        const v = toValue(c);
                        const selected = value.includes(v);
                        return (
                            <button
                                key={v}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => toggleCity(v)}
                                className={cn('h-8 rounded-full px-3 text-[13px] font-medium', choiceClass(selected))}
                            >
                                {c.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <ErrorText message={error} />
        </div>
    );
}
