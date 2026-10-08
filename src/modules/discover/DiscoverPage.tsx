import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, MapPin, Users as UsersIcon, X, Instagram, Youtube, ChevronRight, Loader2, ChevronLeft, Sparkles, Bookmark, ArrowLeft, Wand2, ArrowUpDown, GitCompareArrows, ArrowRight, TrendingUp, Heart, Check } from 'lucide-react';
import { HireManagerButton } from '@/shared/components/HireManagerButton';
import { useTypingPlaceholder } from '@/shared/components/BentoUi';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { FlowButton } from '@/shared/components/FlowButton';
import { useInfluencerSearch, useAiInfluencerSearch } from './hooks/useInfluencers';
import { BADGE_METADATA } from '@/shared/constants/badges';
import { useAuthStore } from '@/shared/stores/authStore';
import { cn } from '@/lib/utils';
import { SaveToCollectionModal } from './components/SaveToCollectionModal';
import { InfluencerCard } from './components/InfluencerCard';
import { ShortlistCard } from './components/ShortlistCard';
import { InfoTooltip } from '@/shared/components/InfoTooltip';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/shared/ui/select';
import { computeBrandFit, canScoreBrandFit, brandFitClasses } from '@/shared/utils/brandFit';
import { MAX_COMPARE, useCompareStore } from './stores/compareStore';

// Radix Select forbids an empty-string item value, so the "no filter" options for
// location/badges (whose real value is '') use this sentinel and map back to '' on change.
const ALL_VALUE = '__all__';

// What the AI search turns into filters, shown as hint chips under the AI box.
const AI_UNDERSTANDS = [
    { label: 'Niche', icon: Filter },
    { label: 'Platform', icon: Instagram },
    { label: 'Tier', icon: UsersIcon },
    { label: 'City', icon: MapPin },
    { label: 'Followers', icon: TrendingUp },
    { label: 'Engagement', icon: Heart },
];
const AI_UNDERSTANDS_DELAYS = ['[animation-delay:500ms]', '[animation-delay:550ms]', '[animation-delay:600ms]', '[animation-delay:650ms]', '[animation-delay:700ms]', '[animation-delay:750ms]'];

// Example searches: typed out in the AI box's placeholder and offered as one-click chips.
const AI_EXAMPLES = [
    'Fashion nano influencers on Instagram in Bangalore',
    'Food creators in Hyderabad with 10K+ followers',
    'Top 5 tech YouTubers',
    'Fitness micro-influencers in Mumbai',
];

// "Ask AI to find creators" rises word by word, after the card itself has faded in.
const AI_TITLE_DELAYS = ['[animation-delay:300ms]', '[animation-delay:360ms]', '[animation-delay:420ms]', '[animation-delay:480ms]', '[animation-delay:540ms]'];

// Title words rise in one after another; literal classes so Tailwind can see each delay.
const TITLE_RISE_DELAYS = ['[animation-delay:150ms]', '[animation-delay:260ms]', '[animation-delay:370ms]'];

// Filter pills: "Label  Value  ⌄" sized to their content. A filter in use turns black with
// its value in brand yellow, so active filters read at a glance.
const FILTER_PILL = 'h-8 w-auto gap-1.5 rounded-lg border-border bg-card px-2.5 text-xs shadow-sm transition-colors hover:border-foreground/40 focus:ring-0 focus:ring-offset-0 data-[state=open]:border-foreground [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60';
const FILTER_PILL_ACTIVE = 'border-foreground bg-foreground text-background hover:border-foreground [&>span:last-of-type]:font-semibold [&>span:last-of-type]:text-brand [&>svg]:opacity-90';

/** What a filter pill shows after its label: "All", the value, or "first +N" for several. */
const pillValue = (raw: string, labelOf: (v: string) => string = (v) => v): string => {
    const values = raw.split('|').map((v) => v.trim()).filter((v) => v && v !== 'All' && v !== 'all');
    if (values.length === 0) return 'All';
    return values.length === 1 ? labelOf(values[0]) : `${labelOf(values[0])} +${values.length - 1}`;
};

// Entrance stagger for the badge shelf and the result cards (literal classes for Tailwind).
// Solid colour per badge for the shelf's icon tile, top accent line and selected outline.
// Same hues as BADGE_METADATA's tints, so a badge reads as one colour everywhere.
const BADGE_ACCENTS: Record<string, { tile: string; bar: string; ring: string }> = {
    top_creator: { tile: 'bg-amber-500 text-white', bar: 'bg-amber-500', ring: 'border-amber-500' },
    trending: { tile: 'bg-purple-500 text-white', bar: 'bg-purple-500', ring: 'border-purple-500' },
    viral_creator: { tile: 'bg-pink-500 text-white', bar: 'bg-pink-500', ring: 'border-pink-500' },
    fast_delivery: { tile: 'bg-teal-500 text-white', bar: 'bg-teal-500', ring: 'border-teal-500' },
    brand_favourite: { tile: 'bg-blue-500 text-white', bar: 'bg-blue-500', ring: 'border-blue-500' },
    rising_star: { tile: 'bg-green-500 text-white', bar: 'bg-green-500', ring: 'border-green-500' },
};
const DEFAULT_BADGE_ACCENT = { tile: 'bg-foreground text-brand', bar: 'bg-brand', ring: 'border-foreground' };

// Brand Fit legend: the same bands and colours the score ring on each card uses (see bandFor in brandFit.ts).
const FIT_LEGEND = [
    { band: 'excellent', label: 'Excellent 80%+' },
    { band: 'good', label: 'Good 60–79%' },
    { band: 'fair', label: 'Fair 40–59%' },
    { band: 'low', label: 'Low <40%' },
] as const;

const BADGE_DELAYS = ['[animation-delay:240ms]', '[animation-delay:280ms]', '[animation-delay:320ms]', '[animation-delay:360ms]', '[animation-delay:400ms]', '[animation-delay:440ms]'];
const CARD_DELAYS = ['[animation-delay:0ms]', '[animation-delay:50ms]', '[animation-delay:100ms]', '[animation-delay:150ms]', '[animation-delay:200ms]', '[animation-delay:250ms]', '[animation-delay:300ms]', '[animation-delay:350ms]', '[animation-delay:400ms]', '[animation-delay:450ms]', '[animation-delay:500ms]', '[animation-delay:550ms]'];

// A filter can hold several values at once — "influencers from vizag and hyderabad and
// chennai" is one search over three cities, ORed. They travel through the URL and the API
// as one separated string. Pipe rather than comma because location labels already contain
// commas ("Visakhapatnam, India") and would be torn in half by a comma split; the backend
// splits on the same character (MULTI_VALUE_SEPARATOR in influencers.service.ts).
const VALUE_SEPARATOR = '|';
const joinValues = (values: string[]): string => values.join(VALUE_SEPARATOR);
const splitValues = (raw: string): string[] =>
    raw.split(VALUE_SEPARATOR).map((v) => v.trim()).filter(Boolean);

/**
 * The filter bar is single-select, but an AI query can legitimately apply several values to
 * one dimension. Rather than rebuild every dropdown as a multi-select, surface the combined
 * set as its own option: the trigger then reads "Visakhapatnam, India +2" instead of falling
 * back to the placeholder (which made a three-city search look like no filter at all), and
 * picking any single option replaces the whole set.
 */
function MultiValueOption({ raw }: { raw: string }) {
    const parts = splitValues(raw);
    if (parts.length < 2) return null;
    return (
        <SelectItem value={raw}>{`${parts[0]} +${parts.length - 1}`}</SelectItem>
    );
}

const NICHES = [
    'All',
    'Tech (Apps & SaaS)',
    'Food & Beverage',
    'Fashion & Beauty',
    'Entertainment & Media',
    'Education & Coaching',
    'Real Estate',
    'Hospitality & Travel',
    'Local Business',
    'Healthcare / Medical',
    'Agencies',
    'Jewellery & Accessories',
    'Health & Fitness',
    'Automobiles',
    'Finance & Fintech',
    'Electronics & Gadgets',
    'Baby & Parenting',
    'NGO & Social Cause',
    'Others',
];
const PLATFORMS = [
    { key: 'all', label: 'All', icon: null },
    { key: 'instagram', label: 'Instagram', icon: Instagram },
    { key: 'youtube', label: 'YouTube', icon: Youtube },
];

const CREATOR_SIZES = ['All', 'Nano', 'Micro', 'Mid', 'Macro', 'Mega'];

// Every filter an AI search sets. Cleared as a block so one query's filters never leak into
// the next — including the numeric and campaign-history ones, which have no dropdown.
const AI_FILTER_RESET: Record<string, string | number> = {
    q: '', niche: 'All', platform: 'all', tier: 'All', location: '', badges: '',
    minFollowers: '', maxFollowers: '', minReelViews: '', minEngagement: '', workedOn: '',
    minReach: '', count: '',
};

// Short names for the sort button; the menu keeps the full descriptions.
const SORT_SHORT_LABELS: Record<string, string> = {
    relevance: 'Relevance',
    best: 'Best match',
    engagement: 'Engagement',
    followers: 'Followers',
    fit: 'Best brand fit',
};

const SORT_LABELS: Record<string, string> = {
    relevance: 'Relevance',
    best: 'Best match — audience size, then verified data',
    engagement: 'Engagement rate',
    followers: 'Followers',
    fit: 'Brand Fit',
};

const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
    if (n >= 1_000) return `${Number((n / 1_000).toFixed(1))}K`;
    return String(n);
};

interface DiscoverPageProps {
    savedOnly?: boolean;
}

export default function DiscoverPage({ savedOnly = false }: DiscoverPageProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);
    const [showPromo, setShowPromo] = useState(false);
    const [selectedInfluencerForSave, setSelectedInfluencerForSave] = useState<{
        id: string;
        userName: string;
        currentCollection: string | null | undefined;
        isSaved: boolean;
    } | null>(null);
    const [aiQuery, setAiQuery] = useState('');
    const [aiAppliedChips, setAiAppliedChips] = useState<string[] | null>(null);
    // How the AI search interpreted the request, and anything it could not apply.
    const [aiNotes, setAiNotes] = useState<string[]>([]);
    const aiSearch = useAiInfluencerSearch();
    const aiPlaceholder = useTypingPlaceholder(AI_EXAMPLES, aiQuery === '');
    const compareCreators = useCompareStore((state) => state.creators);

    useEffect(() => {
        if (user?.id && !savedOnly) {
            const isClosed = localStorage.getItem(`mutiny_hide_badges_promo_${user.id}`);
            if (!isClosed) {
                setShowPromo(true);
            }
        }
    }, [user?.id, savedOnly]);

    const handleClosePromo = () => {
        if (user?.id) {
            localStorage.setItem(`mutiny_hide_badges_promo_${user.id}`, 'true');
        }
        setShowPromo(false);
    };

    // Read state from URL search parameters instead of local state
    const search = searchParams.get('q') || '';
    const niche = searchParams.get('niche') || 'All';
    const platform = searchParams.get('platform') || 'all';
    const creatorSize = searchParams.get('tier') || 'All';
    const activeCollection = searchParams.get('collection') || 'All';
    const location = searchParams.get('location') || '';
    const badges = searchParams.get('badges') || '';
    const sort = searchParams.get('sort') || 'relevance';
    // Set by the AI search from numbers and history the query actually stated. Kept in the URL
    // like every other filter so a search can be shared and survives a refresh.
    const minFollowers = searchParams.get('minFollowers') || '';
    const maxFollowers = searchParams.get('maxFollowers') || '';
    const minReelViews = searchParams.get('minReelViews') || '';
    const minEngagement = searchParams.get('minEngagement') || '';
    const workedOn = searchParams.get('workedOn') || '';
    const minReach = searchParams.get('minReach') || '';
    // "give me 3": show exactly that many, and let the server explain when fewer match.
    const count = searchParams.get('count') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);

    const updateFilter = (updates: Record<string, string | number>) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            Object.entries(updates).forEach(([key, value]) => {
                if (value === '' || value === 'All' || value === 'all' || (key === 'page' && value === 1)) {
                    next.delete(key);
                } else {
                    next.set(key, value.toString());
                }
            });
            return next;
        }, { replace: true });
    };

    const setSearch = (val: string) => updateFilter({ q: val, page: 1 });

    // The search box types into local state and reaches the URL (and the API) 300ms after the
    // last keystroke, so typing never fires a search per letter. A change made elsewhere (AI
    // search, a removed chip, "Clear all") flows back into the box.
    const [searchInput, setSearchInput] = useState(search);
    const debouncedSearch = useDebounce(searchInput, 300);
    useEffect(() => {
        if (debouncedSearch.trim() !== search) setSearch(debouncedSearch.trim());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);
    useEffect(() => {
        if (search !== debouncedSearch.trim()) setSearchInput(search);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);
    const clearSearch = () => {
        setSearchInput('');
        setSearch('');
    };

    // "/" jumps into the search box from anywhere on the page (unless already typing somewhere).
    const searchInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
            const el = document.activeElement as HTMLElement | null;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
            e.preventDefault();
            searchInputRef.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    const setNiche = (val: string) => updateFilter({ niche: val, page: 1 });
    const setPlatform = (val: string) => updateFilter({ platform: val, page: 1 });
    const setCreatorSize = (val: string) => updateFilter({ tier: val, page: 1 });
    const setActiveCollection = (val: string) => updateFilter({ collection: val, page: 1 });
    const setLocation = (val: string) => updateFilter({ location: val, page: 1 });
    const setBadges = (val: string) => updateFilter({ badges: val, page: 1 });
    const setSort = (val: string) => updateFilter({ sort: val === 'relevance' ? '' : val, page: 1 });
    const setPage = (val: number | ((p: number) => number)) => {
        const newPage = typeof val === 'function' ? val(page) : val;
        updateFilter({ page: newPage });
    };

    const { id: campaignId } = useParams<{ id?: string }>();
    // The shortlist only makes sense where bookmarks exist — not for agents, not when inviting.
    const showShortlist = !campaignId && user?.role !== 'agent';

    // 12 divides evenly by every column count the card grid uses (1 / md:2 / xl:3 / 2xl:4),
    // so the last row is always full. 15 was chosen when the grid topped out at 3 columns;
    // once 2xl:4 was added it left a ragged row of 3 on wide screens.
    const ITEMS_PER_PAGE = 12;

    // Build search filters
    const searchFilters: any = {};
    if (search) searchFilters.q = search;
    if (niche !== 'All') {
        searchFilters.niche = niche;
        // Creator niches are stored in several vocabularies at once ("Fashion & Beauty",
        // "fashion-beauty", "clothing", "makeup"). The default substring match only finds
        // the spellings that literally contain the label, so an AI-picked niche matched a
        // fraction of the creators who actually belong to it. 'canonical' resolves every
        // stored spelling through the niche taxonomy in SQL. Both this dropdown and the AI
        // emit the same NICHES labels, and all of them canonicalize, so it is safe for both.
        searchFilters.nicheMatch = 'canonical';
    }
    if (platform !== 'all') searchFilters.platform = platform;
    if (creatorSize !== 'All') searchFilters.tier = creatorSize.toLowerCase();
    if (location) searchFilters.location = location;
    if (badges) searchFilters.badges = badges;
    // Brand Fit has to be ordered server-side — sorting here could only reorder the 15 rows
    // of the current page, which is meaningless when the match set spans many pages.
    if (sort === 'fit' || sort === 'best' || sort === 'engagement' || sort === 'followers') searchFilters.sort = sort;
    const positive = (value: string) => {
        const n = Number(value);
        return value !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
    };
    if (positive(minFollowers)) searchFilters.minFollowers = positive(minFollowers);
    if (positive(maxFollowers)) searchFilters.maxFollowers = positive(maxFollowers);
    if (positive(minReelViews)) searchFilters.minReelViews = positive(minReelViews);
    if (positive(minEngagement)) searchFilters.minEngagement = positive(minEngagement);
    if (workedOn) searchFilters.workedOn = workedOn;
    if (positive(minReach)) searchFilters.minReach = positive(minReach);
    const wanted = positive(count);
    if (savedOnly) {
        searchFilters.savedOnly = true;
        if (activeCollection !== 'All') {
            searchFilters.collectionName = activeCollection;
        }
    }
    searchFilters.page = wanted ? 1 : page;
    searchFilters.limit = wanted ?? ITEMS_PER_PAGE;
    if (wanted) searchFilters.wanted = wanted;

    const { data: influencersData, isLoading, isFetching, error } = useInfluencerSearch(searchFilters);
    const POPULAR_LOCATIONS = [
        'Mumbai, India',
        'Delhi, India',
        'Bangalore, India',
        'Hyderabad, India',
        'Chennai, India',
        'Pune, India',
        'Kolkata, India',
        'Ahmedabad, India',
        'Jaipur, India',
        'Surat, India',
    ];

    // Unique locations from ALL loaded influencer data (before client filters), plus popular ones
    const allLocations = useMemo(() => {
        const list = influencersData?.data ?? [];
        const locs = new Set<string>(POPULAR_LOCATIONS);

        // Ensure every currently selected location is in the list. Split first: an AI search
        // can select several, and adding the joined string as one entry would collide with
        // the combined option MultiValueOption renders (duplicate Radix Select values).
        splitValues(location).forEach((loc) => locs.add(loc));

        list.forEach((inf) => {
            if (inf.location && inf.location.trim()) locs.add(inf.location.trim());
        });
        return Array.from(locs).sort();
    }, [influencersData?.data, location]);

    // Brand Fit — only meaningful when the signed-in brand has a category or location on file.
    // Declared here because the AI search below switches the sort to Brand Fit on success.
    const brandProfile = { industry: user?.industry, city: user?.city, state: user?.state };
    const canFit = canScoreBrandFit(brandProfile);

    // Sends the free-text box to the AI parser endpoint, which maps it onto the exact
    // niche/platform/tier/location/badge filter vocabulary below (plus leftover keywords).
    // The available options are passed along so the model can only return real filter values.
    const handleAiSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const text = aiQuery.trim();
        if (!text || aiSearch.isPending) return;

        const options = {
            niches: NICHES.filter((n) => n !== 'All' && n !== 'Others'),
            platforms: PLATFORMS.filter((p) => p.key !== 'all').map((p) => p.key),
            tiers: CREATOR_SIZES.filter((s) => s !== 'All').map((s) => s.toLowerCase()),
            badges: Object.values(BADGE_METADATA).map((m) => ({ key: m.key, label: m.label })),
            locations: allLocations,
        };

        aiSearch.mutate(
            { query: text, options },
            {
                onSuccess: (filters) => {
                    const chips: string[] = [];
                    // Guard against placeholder strings ("null"/"none"/…) some models emit
                    // for empty fields, so they never get applied as an actual filter value.
                    const clean = (values: string[] | null | undefined): string[] =>
                        (values ?? [])
                            .map((v) => (v ?? '').trim())
                            .filter((v) => v && !['null', 'none', 'n/a', 'undefined'].includes(v.toLowerCase()));

                    const niches = clean(filters.niches);
                    const platforms = clean(filters.platforms);
                    const tiers = clean(filters.tiers);
                    const locations = clean(filters.locations);
                    const badgeKeys = clean(filters.badges);
                    const keywords = (filters.keywords ?? '').trim();

                    // Reset every filter first so a value from a previous AI query can't linger
                    // and silently zero out this search.
                    //
                    // Ordering follows what the query asked for ('best' unless it asked for
                    // engagement or size). It used to be Brand Fit, which ranks by the brand's
                    // OWN head-office city and industry — so "best influencers in Hyderabad"
                    // from a Mumbai brand was ordered by closeness to Mumbai. Brand Fit is still
                    // one click away in the sort menu.
                    const updates: Record<string, string | number> = {
                        ...AI_FILTER_RESET,
                        sort: filters.rankBy ?? 'best', page: 1,
                    };

                    // Each dimension can carry several values, joined for the URL and the
                    // API; the server ORs them. One chip per value so the user sees every
                    // city they asked for, not just the first.
                    if (niches.length > 0) {
                        updates.niche = joinValues(niches);
                        chips.push(...niches);
                    }
                    if (platforms.length > 0) {
                        updates.platform = joinValues(platforms);
                        chips.push(...platforms.map((p) => PLATFORMS.find((x) => x.key === p)?.label ?? p));
                    }
                    if (tiers.length > 0) {
                        const tierLabels = tiers.map((t) => t.charAt(0).toUpperCase() + t.slice(1));
                        updates.tier = joinValues(tierLabels);
                        chips.push(...tierLabels.map((t) => `${t} tier`));
                    }
                    if (locations.length > 0) {
                        updates.location = joinValues(locations);
                        chips.push(...locations);
                    }
                    if (badgeKeys.length > 0) {
                        updates.badges = joinValues(badgeKeys);
                        chips.push(...badgeKeys.map((b) => BADGE_METADATA[b]?.label ?? b));
                    }
                    if (keywords) {
                        updates.q = keywords;
                        chips.push(`"${keywords}"`);
                    }
                    // Say which audience the threshold is measured on — the search counts
                    // Instagram followers unless YouTube alone was asked for.
                    const audienceLabel = platforms.length === 1 && platforms[0] === 'youtube' ? 'YouTube subscribers' : 'Instagram followers';
                    if (filters.minFollowers) {
                        updates.minFollowers = filters.minFollowers;
                        chips.push(`${audienceLabel} ≥ ${formatCount(filters.minFollowers)}`);
                    }
                    if (filters.maxFollowers) {
                        updates.maxFollowers = filters.maxFollowers;
                        chips.push(`${audienceLabel} ≤ ${formatCount(filters.maxFollowers)}`);
                    }
                    if (filters.minReelViews) {
                        updates.minReelViews = filters.minReelViews;
                        chips.push(`Median reel views ≥ ${formatCount(filters.minReelViews)}`);
                    }
                    if (filters.minEngagement) {
                        updates.minEngagement = filters.minEngagement;
                        chips.push(`Engagement ≥ ${filters.minEngagement}%`);
                    }
                    if (filters.minReach) {
                        updates.minReach = filters.minReach;
                        chips.push(`30-day reach ≥ ${formatCount(filters.minReach)} (Meta)`);
                    }
                    if (filters.resultCount) {
                        updates.count = filters.resultCount;
                        chips.push(`Top ${filters.resultCount}`);
                    }
                    if (filters.workedOn) {
                        updates.workedOn = filters.workedOn.niches.length > 0 ? joinValues(filters.workedOn.niches) : 'any';
                        chips.push(filters.workedOn.niches.length > 0
                            ? `Worked on ${filters.workedOn.niches.join(' / ')} campaigns`
                            : 'Has completed campaigns');
                    }
                    chips.push(`Sorted: ${SORT_LABELS[filters.rankBy ?? 'best']}`);

                    updateFilter(updates);
                    setAiNotes(filters.notes ?? []);
                    // A failed model call comes back 200 with empty lists and the whole query
                    // in `keywords`, which is indistinguishable from a real parse that found
                    // nothing — so say plainly that the AI didn't run instead of dressing a
                    // plain text search up as an AI result.
                    if (filters.aiUnavailable) {
                        setAiAppliedChips(['AI unavailable — searched your text instead']);
                    } else {
                        setAiAppliedChips(chips.length > 0 ? chips : [`No filters matched — searched "${text}"`]);
                    }
                },
                onError: () => {
                    // Request never completed (server down, auth, network). Fall back to a plain
                    // text search so results still load, but don't imply the AI produced this.
                    updateFilter({ ...AI_FILTER_RESET, q: text, sort: 'best', page: 1 });
                    setAiAppliedChips(['AI search failed — searched your text instead']);
                    setAiNotes([]);
                },
            }
        );
    };

    const clearAiSearch = () => {
        setAiQuery('');
        setAiAppliedChips(null);
        setAiNotes([]);
        updateFilter({ ...AI_FILTER_RESET, sort: '', page: 1 });
    };

    // Every filter (text, niche, platform, tier, location, badges, saved) is applied in SQL
    // by /influencers/search, so the rows that come back ARE the result set for this page.
    // This used to re-filter them in the browser with stricter rules than the server's —
    // an exact-string location compare against a "City, Country" dropdown value, a phrase
    // match for the AI's keywords — which silently deleted rows out of an already
    // paginated page and left the count disagreeing with the pager. Trust the server.
    //
    // The one exception is savedOnly: the server can only apply it when the session carries
    // a brandId, and without one isBookmarked comes back false for everyone — so this keeps
    // the Saved page empty rather than showing the whole database. It can never drop a row
    // the server meant to return, since a real bookmark always sets isBookmarked.
    const filtered = useMemo(() => {
        const list = influencersData?.data ?? [];
        return savedOnly ? list.filter((inf) => !!inf.isBookmarked) : list;
    }, [influencersData?.data, savedOnly]);

    // The chips that are real constraints (not the sort order or a status message).
    const aiConstraintChips = (aiAppliedChips ?? []).filter(
        (c) => !c.startsWith('Sorted:') && !c.startsWith('AI ') && !c.startsWith('No filters matched'),
    );

    const hasActiveFilters = search !== '' || niche !== 'All' || platform !== 'all' || creatorSize !== 'All' || location !== '' || badges !== '' || (savedOnly && activeCollection !== 'All')
        || minFollowers !== '' || maxFollowers !== '' || minReelViews !== '' || minEngagement !== '' || workedOn !== ''
        || minReach !== '' || count !== '';

    // Result count at the end of the filter row: "Showing 16 creators".
    const totalResults = influencersData?.meta?.total ?? filtered.length;

    // Each active filter as a removable chip — one per value, since a filter can hold several.
    const activeFilterChips: { key: string; kind: string; label: string; onRemove: () => void }[] = [];
    const pushChips = (kind: string, raw: string, setter: (v: string) => void, labelOf: (v: string) => string = (v) => v) => {
        const values = splitValues(raw);
        values.forEach((value) => activeFilterChips.push({
            key: `${kind}-${value}`,
            kind,
            label: labelOf(value),
            onRemove: () => setter(joinValues(values.filter((v) => v !== value))),
        }));
    };
    if (search) activeFilterChips.push({ key: 'search', kind: 'Search', label: `"${search}"`, onRemove: clearSearch });
    if (niche !== 'All') pushChips('Category', niche, setNiche);
    if (platform !== 'all') pushChips('Platform', platform, setPlatform, (v) => PLATFORMS.find((p) => p.key === v)?.label ?? v);
    if (creatorSize !== 'All') pushChips('Tier', creatorSize, setCreatorSize);
    if (location) pushChips('Location', location, setLocation);
    if (badges) pushChips('Badge', badges, setBadges, (v) => BADGE_METADATA[v]?.label ?? v);

    // Pair each visible creator with its Brand Fit score for the pill on each card.
    // The server already returns the page in fit order when sort === 'fit' (it ranks the
    // whole match set); re-sorting here with the same weights is a stable no-op that just
    // guarantees the visible order matches the scores printed on the cards.
    const displayList = useMemo(() => {
        const scored = filtered.map((inf) => ({
            inf,
            fit: canFit
                ? computeBrandFit(brandProfile, {
                    niches: inf.niches,
                    location: inf.location,
                    engagementRate: inf.engagementRate,
                })
                : null,
        }));
        if (canFit && sort === 'fit') {
            scored.sort((a, b) => (b.fit?.score ?? 0) - (a.fit?.score ?? 0));
        }
        return scored;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtered, canFit, sort, user?.industry, user?.city, user?.state]);

    // pb-10: the dock layout's <main> has no bottom padding of its own on desktop.
    return (
        <div className="w-full animate-fade-in pb-10">
            {/* Same header motion as the dashboard: the trail slides in, the title rises word by
                word, the info icon pops, then the subtitle and the buttons fade up. */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="flex animate-slide-in-left items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground [animation-delay:80ms]">
                        Influencers <ChevronRight className="h-3 w-3" />
                        <span className="text-foreground">{campaignId ? 'Invite' : (savedOnly ? 'Saved lists' : 'Discover')}</span>
                    </p>
                    <h1 className="flex flex-wrap items-center gap-x-[0.28em] font-display text-2xl font-semibold leading-8 tracking-tight sm:text-[28px]">
                        {(campaignId ? 'Invite Creators' : (savedOnly ? 'Saved Lists' : 'Influencers')).split(' ').map((word, i) => (
                            <span key={i} className="-mb-1.5 overflow-hidden pb-1.5">
                                <span className={cn('block animate-rise', TITLE_RISE_DELAYS[Math.min(i, TITLE_RISE_DELAYS.length - 1)])}>{word}</span>
                            </span>
                        ))}
                        <span className="ml-1 inline-flex animate-pop [animation-delay:400ms]">
                            <InfoTooltip
                                text={savedOnly
                                    ? 'Creators you\'ve bookmarked from the Influencers page, optionally grouped into lists.'
                                    : 'Search and filter the full creator database, or describe who you need in the AI box below. Use the bookmark icon on a card to save a creator here.'}
                                side="bottom"
                                iconClassName="h-3.5 w-3.5"
                            />
                        </span>
                    </h1>
                    <p className="mt-1.5 animate-fade-up text-sm text-muted-foreground [animation-delay:320ms]">
                        {campaignId
                            ? 'Find and invite the best talent to your campaign'
                            : (savedOnly ? 'Save creators into a list' : 'Find and invite the perfect creators for your campaigns')}
                    </p>
                </div>
                <div className="flex animate-fade-up flex-wrap gap-2 [animation-delay:200ms]">
                    <HireManagerButton className="h-10 gap-2 rounded-full border-border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:border-foreground hover:bg-card" />
                    {!campaignId && (
                        <Link
                            to="/discover/compare"
                            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:border-foreground"
                        >
                            <GitCompareArrows className="h-4 w-4" />
                            <span>Compare{compareCreators.length > 0 ? ` (${compareCreators.length}/${MAX_COMPARE})` : ''}</span>
                        </Link>
                    )}
                    {savedOnly ? (
                        <Link
                            to="/discover"
                            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:border-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span>All Influencers</span>
                        </Link>
                    ) : (!campaignId && user?.role !== 'agent') ? (
                        <Link
                            to="/saved-creators"
                            className="flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                        >
                            <Bookmark className="h-4 w-4" />
                            <span>Saved</span>
                        </Link>
                    ) : null}
                </div>
            </div>

            {/* ── Hero row: "find" (Ask AI) beside "what I've found" (shortlist) ── */}
            {!campaignId && (
                <div className="mt-6 grid grid-cols-12 items-stretch gap-4">
                {/* AI Natural-Language Search — a light accent card: a brand light runs round its edge, a soft
                    brand glow and a faint dot grid sit behind, and the input is frosted glass. */}
                {!campaignId && (
                    <section className={cn('relative flex animate-fade-up overflow-hidden rounded-3xl p-px shadow-card [animation-delay:120ms]', showShortlist ? 'col-span-12 lg:col-span-8' : 'col-span-12')}>
                        {/* The travelling edge light: a rotating conic sweep behind the 1px gap. */}
                        <span aria-hidden className="ai-card-ring" />
                        <div className="relative flex flex-1 flex-col overflow-hidden rounded-[23px] bg-card bg-gradient-to-br from-brand/[0.09] via-card to-card p-5 text-foreground sm:p-6">
                            <span aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 animate-pulse-soft rounded-full bg-brand/15 blur-3xl" />
                            <span aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-brand/[0.07] blur-3xl" />
                            <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(rgb(0_0_0)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
                            {/* While the AI is working, a thin light runs across the top edge. */}
                            {aiSearch.isPending && (
                                <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden">
                                    <span className="ai-card-scan block h-full w-1/3 bg-gradient-to-r from-transparent via-brand to-transparent" />
                                </span>
                            )}
    
                            <div className="relative flex items-start gap-3.5">
                                {/* Wand tile: pops in, then every few seconds the wand casts — it pulls back,
                                    flicks, and a burst of sparks flies from its tip while the tile's glow swells. */}
                                <span className="relative shrink-0 animate-pop [animation-delay:250ms]">
                                    <span className="ai-wand-tile grid h-10 w-10 place-items-center rounded-xl bg-brand text-black">
                                        <Wand2 className="ai-wand h-[18px] w-[18px]" />
                                    </span>
                                    <span aria-hidden className="pointer-events-none absolute right-2 top-2">
                                        <span className="ai-spark ai-spark-1 h-1.5 w-1.5 bg-foreground" />
                                        <span className="ai-spark ai-spark-2 h-1 w-1 bg-brand-600" />
                                        <span className="ai-spark ai-spark-3 h-1 w-1 bg-brand-600" />
                                        <span className="ai-spark ai-spark-4 h-[3px] w-[3px] bg-foreground/70" />
                                    </span>
                                </span>
                                <div className="min-w-0">
                                    <h2 className="flex flex-wrap items-center gap-x-[0.28em] gap-y-1 font-display text-[17px] font-semibold tracking-tight">
                                        {'Ask AI to find creators'.split(' ').map((word, i) => (
                                            <span key={i} className="-mb-1 overflow-hidden pb-1">
                                                <span className={cn('block animate-rise', AI_TITLE_DELAYS[i])}>{word}</span>
                                            </span>
                                        ))}
                                        <span className="ai-tag-shine ml-1.5 animate-pop rounded-full border border-brand/50 bg-brand/15 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-foreground [animation-delay:750ms]">
                                            AI
                                        </span>
                                        <span className="animate-pop [animation-delay:850ms]">
                                            <InfoTooltip text="Describe who you're looking for in plain English — niche, platform, tier, and city are picked up automatically and turned into filters below. E.g. 'fitness micro-influencers on Instagram in Mumbai'." iconClassName="h-3 w-3" />
                                        </span>
                                    </h2>
                                    <p className="mt-0.5 animate-fade-up text-[13px] text-muted-foreground [animation-delay:700ms]">
                                        Describe who you need in plain words — we turn it into filters.
                                    </p>
                                </div>
                            </div>
    
                            {/* Search box + hints, centred in whatever height the hero row gives the card. */}
                            <div className="relative my-auto py-5">
                            <form onSubmit={handleAiSearch} className="relative flex flex-col gap-2 sm:flex-row">
                                <label className="group/ai flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-background/70 px-4 backdrop-blur transition-all duration-200 focus-within:border-brand focus-within:bg-card focus-within:ring-4 focus-within:ring-brand/20 hover:border-foreground/20">
                                    <Sparkles className="h-4 w-4 shrink-0 text-brand-600 transition-transform duration-300 group-focus-within/ai:rotate-12 group-focus-within/ai:scale-110" />
                                    <input
                                        type="text"
                                        value={aiQuery}
                                        onChange={(e) => setAiQuery(e.target.value)}
                                        disabled={aiSearch.isPending}
                                        placeholder={aiPlaceholder}
                                        aria-label="Describe the creators you're looking for"
                                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60"
                                    />
                                </label>
                                <div className="flex shrink-0 items-center gap-2">
                                    <FlowButton
                                        type="submit"
                                        disabled={!aiQuery.trim()}
                                        loading={aiSearch.isPending}
                                        loadingText="Thinking…"
                                        className="h-12 flex-1 sm:flex-none"
                                    >
                                        Apply
                                    </FlowButton>
                                    {aiAppliedChips && (
                                        <button
                                            type="button"
                                            onClick={clearAiSearch}
                                            className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                                            aria-label="Clear AI search"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </form>

                            {/* What the AI picks up from a sentence — doubles as a hint for what to type. */}
                            <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
                                <span className="mr-0.5 text-xs text-muted-foreground">Understands</span>
                                {AI_UNDERSTANDS.map(({ label, icon: Icon }, i) => (
                                    <span
                                        key={label}
                                        className={cn('flex animate-pop items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-foreground/80', AI_UNDERSTANDS_DELAYS[i])}
                                    >
                                        <Icon className="h-3 w-3" />
                                        {label}
                                    </span>
                                ))}
                            </div>
                            </div>
    
                            {aiAppliedChips ? (
                                <div className="relative flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground">Applied:</span>
                                    {aiAppliedChips.map((chip, i) => (
                                        <span
                                            key={`${chip}-${i}`}
                                            className="animate-pop rounded-full border border-brand/40 bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-foreground"
                                        >
                                            {chip}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div className="relative flex flex-wrap items-center gap-1.5">
                                    <span className="mr-0.5 text-xs text-muted-foreground">Try</span>
                                    {AI_EXAMPLES.map((example) => (
                                        <button
                                            key={example}
                                            type="button"
                                            onClick={() => setAiQuery(example)}
                                            className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-foreground/70 transition-all duration-200 hover:-translate-y-px hover:border-brand hover:bg-brand/10 hover:text-foreground"
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {aiAppliedChips && aiNotes.length > 0 && (
                                <ul className="relative mt-2 space-y-1">
                                    {aiNotes.map((note) => (
                                        <li key={note} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                                            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-brand-600" />
                                            <span>{note}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>
                )}
    
                    {showShortlist && <ShortlistCard className="col-span-12 lg:col-span-4 [animation-delay:200ms]" />}
                </div>
            )}

            {/* Creator Badges shelf — the old announcement as a compact strip. Each badge is also a
                one-click filter; dismissing the explainer keeps the filter row out of the way. */}
            {showPromo && (
                <section className="relative mt-4 animate-fade-up overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-card [animation-delay:260ms]">
                    <button
                        onClick={handleClosePromo}
                        className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        aria-label="Dismiss announcement"
                        title="Dismiss this announcement"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-start gap-3.5 pr-10">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-foreground">
                            <Sparkles className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 font-display text-base font-semibold tracking-tight">
                                Browse by badge
                                <span className="rounded-full bg-foreground px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-brand">New</span>
                                <InfoTooltip text="Badges are awarded automatically from real campaign history and performance — they can't be bought or self-assigned." />
                            </p>
                            <p className="mt-0.5 max-w-[760px] text-[13px] leading-5 text-muted-foreground">
                                Earned from real campaign history on Mutiny — never bought or self-assigned. Tap one to see only those creators.
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
                        {Object.values(BADGE_METADATA).map((meta, i) => {
                            const Icon = meta.icon;
                            const active = splitValues(badges).includes(meta.key);
                            const accent = BADGE_ACCENTS[meta.key] ?? DEFAULT_BADGE_ACCENT;
                            return (
                                <button
                                    key={meta.key}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setBadges(active ? '' : meta.key)}
                                    className={cn(
                                        'group/badge relative flex animate-fade-up items-start gap-2.5 overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card',
                                        meta.bgClass,
                                        active ? cn(accent.ring, 'shadow-card') : meta.borderClass,
                                        BADGE_DELAYS[i],
                                    )}
                                >
                                    {/* Yellow accent line: slides in on hover, stays while the badge is selected. */}
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'absolute inset-x-0 top-0 h-[3px] origin-left transition-transform duration-300 group-hover/badge:scale-x-100',
                                            accent.bar,
                                            active ? 'scale-x-100' : 'scale-x-0',
                                        )}
                                    />
                                    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover/badge:-rotate-6 group-hover/badge:scale-110', accent.tile)}>
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className={cn('flex items-center gap-1.5 text-xs font-semibold', meta.textClass)}>
                                            {meta.label}
                                            {active && <Check className="h-3.5 w-3.5 animate-pop" />}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] leading-[15px] text-muted-foreground">{meta.description}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Command bar: search and every filter in one card. On desktop it simply sticks under
                the top bar so filters stay one click away; the wrapper paints the page colour
                behind it so cards scrolling up never show through the gap. On small screens it
                scrolls with the page, since the wrapped filters would cover most of the screen. */}
            <div className="z-20 mt-2 bg-background py-2 lg:sticky lg:top-16">
            <section className="animate-fade-up space-y-3 [animation-delay:320ms]">
                {/* Row 1: a compact search on the left, sort on the right. The search widens and
                    picks up a soft brand glow while focused (or holding text), then settles back. */}
                <div className="flex items-center justify-between gap-2">
                    <label
                        className={cn(
                            'group/search relative flex h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-border bg-card px-3 shadow-sm transition-all duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:border-foreground/30 sm:w-72',
                            'focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgb(250_203_3_/_0.18),0_6px_20px_-8px_rgb(250_203_3_/_0.55)] sm:focus-within:w-[26rem]',
                            searchInput && 'sm:w-[26rem]',
                        )}
                    >
                        {/* A light that sweeps across the field once each time it gains focus */}
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-brand/25 to-transparent opacity-0 group-focus-within/search:animate-[search-sweep_0.9s_ease-out]" />
                        <Search className="relative h-3.5 w-3.5 shrink-0 text-muted-foreground transition-all duration-300 group-focus-within/search:scale-110 group-focus-within/search:text-foreground" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search creators…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            aria-label="Search creators"
                            className="relative w-full bg-transparent text-[13px] placeholder:text-muted-foreground/70 focus:outline-none focus-visible:shadow-none"
                        />
                        {isFetching && !isLoading && <Loader2 className="relative h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
                        {searchInput ? (
                            <button type="button" onClick={clearSearch} aria-label="Clear search" className="relative grid h-5 w-5 shrink-0 animate-pop place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                                <X className="h-3 w-3" />
                            </button>
                        ) : null}
                    </label>

                    {/* Sort — Brand Fit is only offered when a score can be computed for this brand */}
                    <Select value={sort} onValueChange={setSort}>
                        <SelectTrigger
                            aria-label="Sort creators"
                            className="h-9 w-auto shrink-0 gap-2 rounded-xl border-border bg-card px-3 text-xs shadow-sm transition-colors hover:border-foreground focus:ring-0 focus:ring-offset-0 data-[state=open]:border-foreground [&>svg:last-child]:hidden"
                        >
                            <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                            <span className="hidden text-muted-foreground sm:inline">Sort:</span>
                            <span className="font-semibold">{SORT_SHORT_LABELS[sort] ?? SORT_SHORT_LABELS.relevance}</span>
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="relevance">{SORT_LABELS.relevance}</SelectItem>
                            <SelectItem value="best">{SORT_LABELS.best}</SelectItem>
                            <SelectItem value="engagement">{SORT_LABELS.engagement}</SelectItem>
                            <SelectItem value="followers">{SORT_LABELS.followers}</SelectItem>
                            {canFit && <SelectItem value="fit">{SORT_LABELS.fit}</SelectItem>}
                        </SelectContent>
                    </Select>
                </div>

                {/* Row 2: one compact pill per filter — "Label  Value". A filter in use turns black. */}
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={niche} onValueChange={setNiche}>
                        <SelectTrigger className={cn(FILTER_PILL, niche !== 'All' && FILTER_PILL_ACTIVE)}>
                            <span className="font-medium">Category</span>
                            <span className="max-w-[140px] truncate text-muted-foreground">{pillValue(niche)}</span>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Categories</SelectItem>
                            <MultiValueOption raw={niche} />
                            {NICHES.filter(n => n !== 'All').map((n) => (
                                <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger className={cn(FILTER_PILL, platform !== 'all' && FILTER_PILL_ACTIVE)}>
                            <span className="font-medium">Platform</span>
                            <span className="max-w-[140px] truncate text-muted-foreground">
                                {pillValue(platform, (v) => PLATFORMS.find((p) => p.key === v)?.label ?? v)}
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            <MultiValueOption raw={platform} />
                            {PLATFORMS.map((p) => (
                                <SelectItem key={p.key} value={p.key}>{p.key === 'all' ? 'All Platforms' : p.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={creatorSize} onValueChange={setCreatorSize}>
                        <SelectTrigger className={cn(FILTER_PILL, creatorSize !== 'All' && FILTER_PILL_ACTIVE)}>
                            <span className="font-medium">Tier</span>
                            <span className="max-w-[140px] truncate text-muted-foreground">{pillValue(creatorSize)}</span>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Tiers</SelectItem>
                            <MultiValueOption raw={creatorSize} />
                            {CREATOR_SIZES.filter(s => s !== 'All').map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={location || ALL_VALUE}
                        onValueChange={(v) => setLocation(v === ALL_VALUE ? '' : v)}
                    >
                        <SelectTrigger className={cn(FILTER_PILL, location !== '' && FILTER_PILL_ACTIVE)}>
                            <span className="font-medium">Location</span>
                            <span className="max-w-[140px] truncate text-muted-foreground">
                                {pillValue(location, (v) => v.split(',')[0])}
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>All Locations</SelectItem>
                            <MultiValueOption raw={location} />
                            {allLocations.map((loc) => (
                                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={badges || ALL_VALUE}
                        onValueChange={(v) => setBadges(v === ALL_VALUE ? '' : v)}
                    >
                        <SelectTrigger className={cn(FILTER_PILL, badges !== '' && FILTER_PILL_ACTIVE)}>
                            <span className="font-medium">Badges</span>
                            <span className="max-w-[140px] truncate text-muted-foreground">
                                {pillValue(badges, (v) => BADGE_METADATA[v]?.label ?? v)}
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>All Badges</SelectItem>
                            <MultiValueOption raw={badges} />
                            {Object.values(BADGE_METADATA).map((meta) => (
                                <SelectItem key={meta.key} value={meta.key}>{meta.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <p className="ml-auto pl-2 text-xs text-muted-foreground">
                        {isLoading ? (
                            'Finding creators…'
                        ) : (
                            <>
                                Showing <span className="font-semibold tabular-nums text-foreground">{totalResults.toLocaleString('en-IN')}</span> {totalResults === 1 ? 'creator' : 'creators'}
                            </>
                        )}
                    </p>
                </div>
            </section>
            </div>

            {/* Active filters as removable chips, with the Brand Fit score legend on the right. */}
            {(activeFilterChips.length > 0 || canFit) && (
                <div className="mt-1 flex min-h-8 flex-wrap items-center gap-2">
                    {activeFilterChips.length > 0 && (
                        <>
                            <span className="text-xs text-muted-foreground">Active filters:</span>
                            {activeFilterChips.map((chip) => (
                                <span key={chip.key} className="flex h-7 animate-pop items-center gap-1 rounded-full border border-brand/50 bg-brand/20 pl-2.5 pr-1 text-xs font-medium text-foreground">
                                    <span>{chip.kind}:</span>
                                    <span className="max-w-[180px] truncate">{chip.label}</span>
                                    <button
                                        type="button"
                                        onClick={chip.onRemove}
                                        aria-label={`Remove ${chip.kind} filter ${chip.label}`}
                                        className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-foreground hover:text-brand"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))}
                            <button
                                type="button"
                                onClick={() => updateFilter({ ...AI_FILTER_RESET, collection: 'All', page: 1 })}
                                className="text-xs font-semibold text-foreground underline underline-offset-4 hover:text-foreground/70"
                            >
                                Clear all
                            </button>
                        </>
                    )}
                    {canFit && (
                        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                            {FIT_LEGEND.map(({ band, label }) => (
                                <span key={band} className="flex items-center gap-1.5">
                                    <span className={cn('h-2 w-2 rounded-full', brandFitClasses(band).dot)} />
                                    {label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Loading — shaped like the cards so nothing jumps when they arrive. */}
            {isLoading && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: ITEMS_PER_PAGE }, (_, i) => (
                        <div key={i} className="animate-pulse overflow-hidden rounded-3xl border border-border bg-card">
                            <div className="h-[76px] bg-secondary" />
                            <div className="px-4 pb-4">
                                <div className="-mt-9 h-[72px] w-[72px] rounded-2xl bg-muted ring-4 ring-card" />
                                <div className="mt-3 h-4 w-2/3 rounded-full bg-secondary" />
                                <div className="mt-2 h-3 w-1/2 rounded-full bg-secondary" />
                                <div className="mt-4 h-3 w-full rounded-full bg-secondary" />
                                <div className="mt-2 h-3 w-4/5 rounded-full bg-secondary" />
                                <div className="mt-5 grid grid-cols-3 gap-1.5">
                                    <div className="h-12 rounded-xl bg-secondary" />
                                    <div className="h-12 rounded-xl bg-secondary" />
                                    <div className="h-12 rounded-xl bg-secondary" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && !isLoading && (
                <div className="mt-4 flex min-h-[40vh] items-center justify-center rounded-3xl border border-destructive/20 bg-destructive/5">
                    <p className="text-sm text-destructive">Failed to load influencers. Please try again.</p>
                </div>
            )}

            {/* Asked for N creators and fewer matched: say how many, and which filter limits it
                — every sentence is a real count from the server. */}
            {!isLoading && !error && influencersData?.meta?.shortfall && (
                <div className="mt-4 rounded-2xl border border-border border-l-[3px] border-l-brand bg-card px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">{influencersData.meta.shortfall.reasons[0]}</p>
                    {influencersData.meta.shortfall.reasons.length > 1 && (
                        <ul className="mt-1.5 space-y-1">
                            {influencersData.meta.shortfall.reasons.slice(1).map((reason) => (
                                <li key={reason} className="text-xs leading-relaxed text-muted-foreground">{reason}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Results Grid or Empty State */}
            {!isLoading && !error && (
                filtered.length === 0 ? (
                    <div className="relative mt-4 flex min-h-[44vh] animate-fade-up flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-card px-4 text-center shadow-card">
                        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(rgb(0_0_0)_1px,transparent_1px)] [background-size:18px_18px]" />
                        <span className="relative grid h-14 w-14 animate-pop place-items-center rounded-2xl bg-foreground text-brand shadow-float">
                            <Search className="h-6 w-6" />
                        </span>
                        <h3 className="relative mt-4 font-display text-lg font-semibold tracking-tight">
                            {hasActiveFilters ? 'No creators match these filters' : (savedOnly ? 'No saved creators yet' : 'No creators yet')}
                        </h3>
                        <p className="relative mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                            {hasActiveFilters
                                ? (aiConstraintChips.length > 0
                                    // Name the constraints rather than a generic "adjust niche or
                                    // tier": after an AI search the filter that emptied the list
                                    // is often one with no dropdown (followers, reel views).
                                    ? `No creator matches all of: ${aiConstraintChips.join(' · ')}. Try removing the strictest one.`
                                    : 'Try a broader search, or remove a filter or two.')
                                : (savedOnly
                                    ? 'Tap the bookmark on any creator to keep them here, grouped into lists.'
                                    : 'There are currently no creators available.')
                            }
                        </p>
                        <div className="relative mt-5 flex flex-wrap justify-center gap-2">
                            {hasActiveFilters && (
                                <button
                                    onClick={() => updateFilter({ ...AI_FILTER_RESET, collection: 'All', page: 1 })}
                                    className="h-10 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-all hover:-translate-y-0.5 hover:shadow-float"
                                    title="Reset search, niche, platform, tier, location, and badge filters"
                                >
                                    Clear all filters
                                </button>
                            )}
                            {savedOnly && (
                                <Link to="/discover" className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-5 text-sm font-semibold transition-colors hover:border-foreground">
                                    Browse creators <ChevronRight className="h-4 w-4" />
                                </Link>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Column counts are explicit, not auto-fill: the page serves a fixed
                            ITEMS_PER_PAGE of 12, so the count must divide 12 or the last row
                            is a stranded remainder. 1/2/3/4 all do; 5 does not. */}
                        <div className={cn('mt-4 grid grid-cols-1 gap-4 transition-opacity duration-200 md:grid-cols-2 xl:grid-cols-3', isFetching && 'opacity-60')}>
                            {displayList.map(({ inf, fit }, i) => (
                                <InfluencerCard
                                    key={inf.id}
                                    influencer={inf}
                                    campaignId={campaignId}
                                    canSave={user?.role !== 'agent'}
                                    brandFit={fit}
                                    className={CARD_DELAYS[Math.min(i, CARD_DELAYS.length - 1)]}
                                    onSaveClick={() => setSelectedInfluencerForSave({
                                        id: inf.id,
                                        userName: inf.userName,
                                        currentCollection: inf.collectionName,
                                        isSaved: !!inf.isBookmarked,
                                    })}
                                />
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {!wanted && (influencersData?.meta?.total || 0) > ITEMS_PER_PAGE && (() => {
                            const totalPages = Math.ceil((influencersData?.meta?.total || 0) / ITEMS_PER_PAGE);
                            const WINDOW = 2; // pages around current page to show

                            // Build the list of page numbers/ellipsis tokens to render
                            const pages: (number | '...')[] = [];
                            for (let p = 1; p <= totalPages; p++) {
                                if (
                                    p === 1 ||
                                    p === totalPages ||
                                    (p >= page - WINDOW && p <= page + WINDOW)
                                ) {
                                    pages.push(p);
                                } else if (
                                    (p === page - WINDOW - 1 && p > 1) ||
                                    (p === page + WINDOW + 1 && p < totalPages)
                                ) {
                                    pages.push('...');
                                }
                            }

                            return (
                                <nav aria-label="Pages" className="mt-10 flex justify-center">
                                    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1.5 shadow-card">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1 || isLoading}
                                            className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium transition-colors enabled:hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground/50"
                                            title="Previous page"
                                        >
                                            <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span>
                                        </button>

                                        {pages.map((p, idx) =>
                                            p === '...' ? (
                                                <span key={`ellipsis-${idx}`} className="grid h-9 w-9 place-items-center text-sm text-muted-foreground">
                                                    …
                                                </span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    onClick={() => setPage(p as number)}
                                                    disabled={isLoading}
                                                    title={`Page ${p}`}
                                                    aria-current={page === p ? 'page' : undefined}
                                                    className={cn(
                                                        'grid h-9 w-9 place-items-center rounded-full text-sm font-semibold tabular-nums transition-all duration-200',
                                                        page === p
                                                            ? 'bg-foreground text-brand shadow-sm'
                                                            : 'text-foreground/70 hover:bg-secondary hover:text-foreground disabled:opacity-50',
                                                    )}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        )}

                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page >= totalPages || isLoading}
                                            className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium transition-colors enabled:hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground/50"
                                            title="Next page"
                                        >
                                            <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </nav>
                            );
                        })()}
                    </>
                )
            )}
            {selectedInfluencerForSave && (
                <SaveToCollectionModal
                    influencerId={selectedInfluencerForSave.id}
                    influencerName={selectedInfluencerForSave.userName}
                    currentCollection={selectedInfluencerForSave.currentCollection}
                    isSaved={selectedInfluencerForSave.isSaved}
                    onClose={() => setSelectedInfluencerForSave(null)}
                />
            )}
        </div>
    );
}

