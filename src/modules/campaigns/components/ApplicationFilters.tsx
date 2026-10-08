import { useMemo, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The subset of an application row the filters read. ApplicationsTab builds these from its
 * campaign-influencer view model and attaches the effective workflow status and price.
 */
export interface FilterableApplication {
    id: string;
    name: string;
    handle: string;
    followers: number;
    engagement: number;
    platform: string;
    /** Creator tier — nano / micro / mid / macro / mega. */
    creatorSize: string;
    niche: string[] | string;
    location: string | null;
    /** Effective workflow status (applied, negotiating, accepted, ...). */
    status: string | null;
    /** Agreed / quoted / tier rate in rupees, whichever is known. Null when not yet priced. */
    price: number | null;
}

export interface ApplicationFilterValue {
    search: string;
    statuses: string[];
    tiers: string[];
    platforms: string[];
    locations: string[];
    niches: string[];
    minPrice: string;
    maxPrice: string;
    minFollowers: string;
    maxFollowers: string;
}

export const EMPTY_APPLICATION_FILTERS: ApplicationFilterValue = {
    search: '',
    statuses: [],
    tiers: [],
    platforms: [],
    locations: [],
    niches: [],
    minPrice: '',
    maxPrice: '',
    minFollowers: '',
    maxFollowers: '',
};

const TIER_LABELS: Record<string, string> = {
    nano: 'Nano',
    micro: 'Micro',
    mid: 'Mid',
    macro: 'Macro',
    mega: 'Mega',
};

const STATUS_LABELS: Record<string, string> = {
    applied: 'Applied',
    negotiating: 'Negotiating',
    invited: 'Invited',
    accepted: 'Accepted',
    payment_pending: 'Payment Pending',
    product_pending: 'Product Pending',
    script_pending: 'Script Pending',
    script_review: 'Script Review',
    work_pending: 'Work Pending',
    work_review: 'Work Review',
    proof_review: 'Proof Review',
    paid: 'Paid',
    completed: 'Completed',
    settled: 'Settled',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
    replaced: 'Replaced',
};

function toNicheList(niche: FilterableApplication['niche']): string[] {
    if (Array.isArray(niche)) return niche.filter(Boolean).map(String);
    return niche ? [String(niche)] : [];
}

/** Number of filter groups currently narrowing the list — drives the "N active" badge. */
export function countActiveFilters(value: ApplicationFilterValue): number {
    let count = 0;
    if (value.search.trim()) count += 1;
    count += value.statuses.length > 0 ? 1 : 0;
    count += value.tiers.length > 0 ? 1 : 0;
    count += value.platforms.length > 0 ? 1 : 0;
    count += value.locations.length > 0 ? 1 : 0;
    count += value.niches.length > 0 ? 1 : 0;
    if (value.minPrice.trim() || value.maxPrice.trim()) count += 1;
    if (value.minFollowers.trim() || value.maxFollowers.trim()) count += 1;
    return count;
}

/**
 * Applies the filter set to a list of applications.
 *
 * Every group is AND-ed together; values within a group are OR-ed. Rows with no price yet
 * (never quoted, still invited) are excluded once a price bound is set, since an unknown
 * price cannot be said to fall inside the requested range.
 */
export function filterApplications<T extends FilterableApplication>(
    applications: T[],
    value: ApplicationFilterValue,
): T[] {
    const search = value.search.trim().toLowerCase();
    const minPrice = value.minPrice.trim() ? Number(value.minPrice) : null;
    const maxPrice = value.maxPrice.trim() ? Number(value.maxPrice) : null;
    const minFollowers = value.minFollowers.trim() ? Number(value.minFollowers) : null;
    const maxFollowers = value.maxFollowers.trim() ? Number(value.maxFollowers) : null;

    return applications.filter((app) => {
        if (search) {
            const haystack = `${app.name} ${app.handle}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        if (value.statuses.length > 0 && !value.statuses.includes(String(app.status ?? ''))) {
            return false;
        }
        if (value.tiers.length > 0 && !value.tiers.includes(String(app.creatorSize ?? ''))) {
            return false;
        }
        if (value.platforms.length > 0) {
            const platform = String(app.platform ?? '');
            // A creator who applied on 'both' should surface when filtering either platform.
            const matchesPlatform =
                value.platforms.includes(platform) ||
                (platform === 'both' && (value.platforms.includes('instagram') || value.platforms.includes('youtube')));
            if (!matchesPlatform) return false;
        }
        if (value.locations.length > 0 && !value.locations.includes(String(app.location ?? ''))) {
            return false;
        }
        if (value.niches.length > 0) {
            const niches = toNicheList(app.niche);
            if (!niches.some((n) => value.niches.includes(n))) return false;
        }

        if (minPrice !== null || maxPrice !== null) {
            if (app.price === null) return false;
            if (minPrice !== null && app.price < minPrice) return false;
            if (maxPrice !== null && app.price > maxPrice) return false;
        }

        if (minFollowers !== null && app.followers < minFollowers) return false;
        if (maxFollowers !== null && app.followers > maxFollowers) return false;

        return true;
    });
}

interface PillGroupProps {
    label: string;
    options: { value: string; label: string; count: number }[];
    selected: string[];
    onToggle: (optionValue: string) => void;
}

function PillGroup({ label, options, selected, onToggle }: PillGroupProps) {
    if (options.length === 0) return null;

    return (
        <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {label}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => {
                    const isOn = selected.includes(opt.value);
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onToggle(opt.value)}
                            className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-premium',
                                isOn
                                    ? 'border-foreground bg-foreground text-background'
                                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                            )}
                        >
                            {opt.label}
                            <span className={cn('text-[10px]', isOn ? 'opacity-70' : 'opacity-50')}>
                                {opt.count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

interface RangeInputsProps {
    label: string;
    prefix?: string;
    minValue: string;
    maxValue: string;
    onMinChange: (v: string) => void;
    onMaxChange: (v: string) => void;
}

function RangeInputs({ label, prefix, minValue, maxValue, onMinChange, onMaxChange }: RangeInputsProps) {
    const sanitize = (raw: string) => raw.replace(/\D/g, '').slice(0, 12);

    return (
        <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {label}
            </p>
            <div className="flex items-center gap-2">
                {(['min', 'max'] as const).map((bound) => (
                    <div key={bound} className="relative flex-1 min-w-0">
                        {prefix && (
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                {prefix}
                            </span>
                        )}
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder={bound === 'min' ? 'Min' : 'Max'}
                            value={bound === 'min' ? minValue : maxValue}
                            onChange={(e) => {
                                const next = sanitize(e.target.value);
                                if (bound === 'min') onMinChange(next);
                                else onMaxChange(next);
                            }}
                            className={cn(
                                'w-full h-9 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/50',
                                prefix ? 'pl-6 pr-2.5' : 'px-2.5',
                            )}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

interface ApplicationFiltersProps {
    /** The full, unfiltered list — drives which options appear and their counts. */
    applications: FilterableApplication[];
    value: ApplicationFilterValue;
    onChange: (next: ApplicationFilterValue) => void;
    /** How many rows survive the current filters, for the results summary. */
    resultCount: number;
}

/**
 * Filter panel for the Applications tab.
 *
 * Options are derived from the campaign's own applicants rather than a fixed list, so a brand
 * never sees a filter that would return nothing — and each pill carries its own match count.
 */
export function ApplicationFilters({
    applications,
    value,
    onChange,
    resultCount,
}: ApplicationFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);
    const activeCount = countActiveFilters(value);

    const buildOptions = (
        pick: (app: FilterableApplication) => string[],
        labelFor: (raw: string) => string,
    ) => {
        const counts = new Map<string, number>();
        for (const app of applications) {
            for (const raw of pick(app)) {
                if (!raw) continue;
                counts.set(raw, (counts.get(raw) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries())
            .map(([raw, count]) => ({ value: raw, label: labelFor(raw), count }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    };

    const titleCase = (raw: string) =>
        raw.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const statusOptions = useMemo(
        () => buildOptions((a) => [String(a.status ?? '')], (raw) => STATUS_LABELS[raw] ?? titleCase(raw)),
        [applications],
    );
    const tierOptions = useMemo(
        () => buildOptions((a) => [String(a.creatorSize ?? '')], (raw) => TIER_LABELS[raw] ?? titleCase(raw)),
        [applications],
    );
    const platformOptions = useMemo(
        () => buildOptions((a) => [String(a.platform ?? '')], titleCase),
        [applications],
    );
    const locationOptions = useMemo(
        () => buildOptions((a) => [String(a.location ?? '')], (raw) => raw),
        [applications],
    );
    const nicheOptions = useMemo(
        () => buildOptions((a) => toNicheList(a.niche), titleCase),
        [applications],
    );

    const update = <K extends keyof ApplicationFilterValue>(
        key: K,
        next: ApplicationFilterValue[K],
    ) => onChange({ ...value, [key]: next });

    const toggleIn = (key: 'statuses' | 'tiers' | 'platforms' | 'locations' | 'niches') =>
        (optionValue: string) => {
            const current = value[key];
            update(
                key,
                current.includes(optionValue)
                    ? current.filter((v) => v !== optionValue)
                    : [...current, optionValue],
            );
        };

    return (
        <div className="bg-card border border-border rounded-2xl mb-4">
            <div className="flex flex-wrap items-center gap-2 p-3">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name or handle..."
                        value={value.search}
                        onChange={(e) => update('search', e.target.value)}
                        className="w-full h-9 pl-9 pr-8 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                    />
                    {value.search && (
                        <button
                            type="button"
                            onClick={() => update('search', '')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className={cn(
                        'inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-premium',
                        isOpen || activeCount > 0
                            ? 'border-foreground/30 bg-secondary/60 text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {activeCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#fedc03] text-black text-[10px] font-bold leading-none">
                            {activeCount}
                        </span>
                    )}
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
                </button>

                {activeCount > 0 && (
                    <button
                        type="button"
                        onClick={() => onChange(EMPTY_APPLICATION_FILTERS)}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-premium"
                    >
                        <X className="w-3.5 h-3.5" />
                        Clear all
                    </button>
                )}

                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {resultCount} of {applications.length}
                </span>
            </div>

            {isOpen && (
                <div className="border-t border-border p-4 grid grid-cols-1 sm:grid-cols-2 gap-5 animate-fade-in">
                    <PillGroup
                        label="Status"
                        options={statusOptions}
                        selected={value.statuses}
                        onToggle={toggleIn('statuses')}
                    />
                    <PillGroup
                        label="Creator Tier"
                        options={tierOptions}
                        selected={value.tiers}
                        onToggle={toggleIn('tiers')}
                    />
                    <PillGroup
                        label="Platform"
                        options={platformOptions}
                        selected={value.platforms}
                        onToggle={toggleIn('platforms')}
                    />
                    <PillGroup
                        label="Location"
                        options={locationOptions}
                        selected={value.locations}
                        onToggle={toggleIn('locations')}
                    />
                    <PillGroup
                        label="Niche"
                        options={nicheOptions}
                        selected={value.niches}
                        onToggle={toggleIn('niches')}
                    />
                    <div className="space-y-5">
                        <RangeInputs
                            label="Price Range"
                            prefix="₹"
                            minValue={value.minPrice}
                            maxValue={value.maxPrice}
                            onMinChange={(v) => update('minPrice', v)}
                            onMaxChange={(v) => update('maxPrice', v)}
                        />
                        <RangeInputs
                            label="Followers"
                            minValue={value.minFollowers}
                            maxValue={value.maxFollowers}
                            onMinChange={(v) => update('minFollowers', v)}
                            onMaxChange={(v) => update('maxFollowers', v)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
