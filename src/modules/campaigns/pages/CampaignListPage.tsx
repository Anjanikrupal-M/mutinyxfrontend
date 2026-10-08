import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, LockKeyhole, Globe, LayoutGrid, Sparkles, ChevronLeft, ChevronRight, Search, X, Plus, Megaphone } from 'lucide-react';
import { InfoTooltip } from '@/shared/components/InfoTooltip';
import { useCampaigns } from '@/modules/campaigns/hooks/useCampaigns';
import { CampaignCard } from '@/modules/campaigns/components/CampaignCard';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/shared/stores/authStore';
import { useDebounce } from '@/shared/hooks';
import { useTypingPlaceholder } from '@/shared/components/BentoUi';

const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'draft', label: 'Draft' },
    // Launched campaigns queued for admin review (status stays 'draft' server-side).
    { key: 'awaiting_approval', label: 'Waiting Approval' },
    { key: 'ai-strategy', label: 'AI Strategy', isAI: true },
    { key: 'completed', label: 'Completed' },
    { key: 'expired', label: 'Expired' },
    { key: 'withdrawn', label: 'Withdrawn' },
    { key: 'agents', label: 'Agents Created', isAgent: true },
];

const VISIBILITY_FILTERS = [
    { key: 'all', label: 'All', icon: LayoutGrid },
    { key: 'private', label: 'Private', icon: LockKeyhole },
    { key: 'public', label: 'Public', icon: Globe },
];

// Header title rises word by word; cards fade up one after another (literal classes so Tailwind sees them).
const TITLE_RISE_DELAYS = ['[animation-delay:150ms]', '[animation-delay:260ms]', '[animation-delay:370ms]'];
// Example searches the placeholder types out (module-level so the hook's effect stays stable).
const SEARCH_EXAMPLES = ['Summer Glow', 'UGC unboxing', 'Diwali festive edit', 'Food review series'];
const CARD_DELAYS = ['[animation-delay:0ms]', '[animation-delay:50ms]', '[animation-delay:100ms]', '[animation-delay:150ms]', '[animation-delay:200ms]', '[animation-delay:250ms]', '[animation-delay:300ms]', '[animation-delay:350ms]'];

import { CampaignRoomSync } from '@/shared/components/CampaignRoomSync';

export default function CampaignListPage() {
    return (
        <>
            <CampaignRoomSync />
            <CampaignListPageContent />
        </>
    );
}

function CampaignListPageContent() {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const [searchInput, setSearchInput] = useState('');
    // "/" anywhere on the page (outside a field) jumps into the search, like most command bars.
    const searchRef = useRef<HTMLInputElement>(null);
    const typedExample = useTypingPlaceholder(SEARCH_EXAMPLES, searchInput === '');
    // The hook speaks in "e.g. …"; here it reads as a search prompt. Falls back to the plain
    // prompt before typing starts and for reduced motion.
    const searchPlaceholder = typedExample === `e.g. ${SEARCH_EXAMPLES[0]}`
        ? 'Search campaigns by name...'
        : typedExample.replace(/^e\.g\. /, 'Try ');
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
            e.preventDefault();
            searchRef.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    // 12, not 15: the grid runs at 1/2/3/4 columns and 12 divides all of them, so the last
    // row is always full. 15 left a stranded row of 3 under a 4-column layout.
    const limit = 12;
    const activeTab = params.get('status') || 'all';
    const activeVisibility = params.get('visibility') || 'all';
    const debouncedSearch = useDebounce(searchInput.trim(), 300);

    // Page lives in the URL, not component state, so it survives a refresh and —
    // more importantly — coming back from a campaign detail page.
    const parsedPage = Number(params.get('page'));
    const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;

    // Handed to each card so the detail page's Back button can return to this exact list —
    // page, status tab and visibility filter together — instead of resetting to page 1.
    const listSearch = params.toString() ? `?${params.toString()}` : '';

    const setPage = useCallback(
        (next: number) => {
            setParams(
                (current) => {
                    const newParams = new URLSearchParams(current);
                    // Page 1 is the default — keep it out of the URL.
                    if (next <= 1) newParams.delete('page');
                    else newParams.set('page', String(next));
                    return newParams;
                },
                { replace: true },
            );
        },
        [setParams],
    );

    const user = useAuthStore(s => s.user);
    const isBrandOwner = user?.role === 'brand_owner';

    // Reset to page 1 whenever the search term changes. Guarded against the mount
    // run, which would otherwise wipe the page out of a deep-linked ?page=3 URL.
    const prevSearchRef = useRef(debouncedSearch);
    useEffect(() => {
        if (prevSearchRef.current === debouncedSearch) return;
        prevSearchRef.current = debouncedSearch;
        setPage(1);
    }, [debouncedSearch, setPage]);

    // Build API filters from URL params
    const filters: Record<string, string> = {};
    // 'expired' and 'awaiting_approval' are virtual statuses the API resolves itself
    // (active + deadline past + no applications / draft + approval pending), so they pass
    // straight through — filtering client-side would only ever see the current page of an
    // unfiltered result set. 'ai-strategy' and 'agents' are not statuses at all: they map to
    // their own API filters, aiOnly and agentOnly.
    if (activeTab !== 'all' && activeTab !== 'ai-strategy' && activeTab !== 'agents') {
        filters.status = activeTab;
    }
    if (activeTab === 'agents') {
        filters.agentOnly = 'true';
    }
    if (activeTab === 'ai-strategy') {
        filters.aiOnly = 'true';
    }
    if (activeVisibility === 'private' || activeVisibility === 'public') {
        filters.visibility = activeVisibility;
    }
    if (debouncedSearch) {
        filters.search = debouncedSearch;
    }
    filters.limit = String(limit);
    filters.page = String(page);

    const { data: campaignsData, isLoading, error } = useCampaigns(filters);

    // Every tab is resolved server-side, so pages stay full and the footer's totals describe
    // what is on screen. Nothing is filtered here: the AI Strategy tab was the last holdout and
    // it could never work client-side — it tested `aiStrategy`, a blob only the legacy
    // AIStrategistChat writes, over one page of an unfiltered result set.
    const campaigns = campaignsData?.data ?? [];

    const updateFilter = (key: string, value: string) => {
        const newParams = new URLSearchParams(params);
        if (value === 'all') {
            newParams.delete(key);
        } else {
            newParams.set(key, value);
        }
        // Must happen in the SAME setParams call as the filter change — a separate
        // setPage(1) would rebuild from a stale `params` and undo the filter.
        newParams.delete('page');
        setParams(newParams);
    };

    const meta = campaignsData?.meta;
    const totalPages = meta ? ((meta as any).totalPages ?? Math.ceil(meta.total / limit)) : 1;

    // A stale ?page= (bookmark, back button, or a filter that now yields fewer pages)
    // would otherwise render an empty grid with no way back. Snap to the last real page.
    useEffect(() => {
        if (!meta || isLoading) return;
        const lastPage = Math.max(1, totalPages);
        if (page > lastPage) setPage(lastPage);
    }, [meta, isLoading, page, totalPages, setPage]);

    // Paging while scrolled down otherwise lands the user mid-list on the new page —
    // the grid swaps under them and looks like nothing happened. Skips the mount run
    // so returning from a campaign detail keeps the browser's restored scroll position.
    const didMountRef = useRef(false);
    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [page]);

    const getPaginationRange = (currentPage: number, total: number) => {
        const delta = 2;
        const range: number[] = [];
        const rangeWithDots: (number | '...')[] = [];
        let l: number | undefined;

        for (let i = 1; i <= total; i++) {
            if (i === 1 || i === total || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        for (const i of range) {
            if (l !== undefined) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l > 2) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

    const paginationRange = getPaginationRange(page, totalPages);

    const rangeStart = campaigns.length === 0 ? 0 : (page - 1) * limit + 1;
    const rangeEnd = (page - 1) * limit + campaigns.length;

    const statusLabel = STATUS_TABS.find((tab) => tab.key === activeTab)?.label;
    const visibilityLabel = VISIBILITY_FILTERS.find((vf) => vf.key === activeVisibility)?.label;
    const hasFilters = activeTab !== 'all' || activeVisibility !== 'all' || !!debouncedSearch;

    return (
        <div className="w-full animate-fade-in pb-10">
            {/* Same header motion as the dashboard and Influencers: the trail slides in, the title
                rises word by word, the info icon pops, then the subtitle and the button fade up. */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="flex animate-slide-in-left items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground [animation-delay:80ms]">
                        Campaigns <ChevronRight className="h-3 w-3" />
                        <span className="text-foreground">{statusLabel && activeTab !== 'all' ? statusLabel : 'All campaigns'}</span>
                    </p>
                    <h1 className="flex flex-wrap items-center gap-x-[0.28em] font-display text-2xl font-semibold leading-8 tracking-tight sm:text-[28px]">
                        {'Your Campaigns'.split(' ').map((word, i) => (
                            <span key={i} className="-mb-1.5 overflow-hidden pb-1.5">
                                <span className={cn('block animate-rise', TITLE_RISE_DELAYS[Math.min(i, TITLE_RISE_DELAYS.length - 1)])}>{word}</span>
                            </span>
                        ))}
                        <span className="ml-1 inline-flex animate-pop [animation-delay:400ms]">
                            <InfoTooltip
                                text="Every campaign you've created, from draft to payout. Filter by status and open one to manage applications, scripts, and content."
                                side="bottom"
                                iconClassName="h-3.5 w-3.5"
                            />
                        </span>
                    </h1>
                    <p className="mt-1.5 animate-fade-up text-sm text-muted-foreground [animation-delay:320ms]">
                        Manage every influencer marketing campaign — from application to payout.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/campaigns/create?fresh=true')}
                    className="group/create flex h-10 animate-fade-up items-center gap-2 rounded-full bg-foreground pl-1.5 pr-4 text-sm font-semibold text-background shadow-card transition-all duration-300 [animation-delay:200ms] hover:shadow-float"
                >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-black transition-transform duration-300 group-hover/create:rotate-90">
                        <Plus className="h-4 w-4" />
                    </span>
                    Create campaign
                </button>
            </div>


            {/* Filters as three cards. Top row: the search card (lifts with a soft yellow glow on
                focus; "/" jumps into it) beside the visibility card (a white pill slides between
                options). Below: the status card, a yellow underline gliding to the active tab. */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
                {/* Glass search pill: frosted fill with a bright top edge, a sheen that sweeps across
                    every few seconds, and a typing placeholder. On focus a soft yellow aura glows
                    behind it, it widens a little and the icon tilts. */}
                <div className="group/search relative w-full min-w-0 animate-fade-up transition-[width] duration-500 [animation-delay:240ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] sm:w-80 lg:w-[380px] lg:focus-within:w-[440px]">
                    <span aria-hidden className="pointer-events-none absolute -inset-2 rounded-full bg-[radial-gradient(55%_120%_at_25%_50%,rgb(250_203_3_/_0.5),transparent_70%)] opacity-0 blur-lg transition-opacity duration-500 group-focus-within/search:opacity-100" />
                    <label className="relative flex h-12 items-center gap-2.5 overflow-hidden rounded-full border border-white/80 bg-gradient-to-b from-white/90 to-white/55 px-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.95),inset_0_-1px_0_rgb(0_0_0_/_0.04),0_1px_2px_rgb(0_0_0_/_0.04),0_10px_28px_-14px_rgb(0_0_0_/_0.22)] ring-1 ring-black/[0.06] backdrop-blur-xl transition-all duration-300 hover:ring-black/10 group-focus-within/search:from-white group-focus-within/search:to-white/80 group-focus-within/search:ring-black/15">
                        <span aria-hidden className="search-sheen pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/90 to-transparent" />
                        <Search className="relative h-4 w-4 shrink-0 text-muted-foreground transition-all duration-300 group-focus-within/search:-rotate-12 group-focus-within/search:scale-110 group-focus-within/search:text-foreground" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={searchPlaceholder}
                            aria-label="Search campaigns by name"
                            className="relative h-full w-full bg-transparent text-sm placeholder:text-muted-foreground/75 focus:outline-none focus-visible:shadow-none"
                        />
                        {searchInput && (
                            <button type="button" onClick={() => setSearchInput('')} aria-label="Clear search" className="relative grid h-6 w-6 shrink-0 animate-pop place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-110">
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </label>
                </div>

                {/* Visibility switch — glass pill to match the search. The selected option is a black
                    pill that springs across with a little bounce (stretching to each label's width),
                    its icon turns yellow and pops. */}
                <div
                    className="flex h-12 shrink-0 animate-fade-up items-center gap-0.5 rounded-full border border-white/80 bg-gradient-to-b from-white/90 to-white/55 p-1 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.95),inset_0_-1px_0_rgb(0_0_0_/_0.04),0_1px_2px_rgb(0_0_0_/_0.04),0_10px_28px_-14px_rgb(0_0_0_/_0.22)] ring-1 ring-black/[0.06] backdrop-blur-xl [animation-delay:290ms]"
                    role="group"
                    aria-label="Visibility"
                >
                    {VISIBILITY_FILTERS.map((vf) => {
                        const active = activeVisibility === vf.key;
                        const Icon = vf.icon;
                        return (
                            <button
                                key={vf.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() => updateFilter('visibility', vf.key)}
                                className={cn(
                                    'relative flex h-full flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] transition-[color,transform] duration-200 active:scale-95',
                                    active ? 'font-semibold text-background' : 'font-medium text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {/* Hover wash for the idle options. */}
                                {!active && <span aria-hidden className="absolute inset-0 rounded-full bg-black/[0.04] opacity-0 transition-opacity duration-200 hover:opacity-100" />}
                                {active && (
                                    <motion.span
                                        layoutId="campaign-visibility-pill"
                                        transition={{ type: 'spring', stiffness: 420, damping: 26, mass: 0.8 }}
                                        className="absolute inset-0 rounded-full bg-foreground shadow-[0_8px_18px_-8px_rgb(250_203_3_/_0.9),inset_0_1px_0_rgb(255_255_255_/_0.15)]"
                                    />
                                )}
                                {/* Keyed on state so the pop replays each time the option is picked. */}
                                <Icon
                                    key={active ? 'on' : 'off'}
                                    className={cn('relative h-3.5 w-3.5 transition-colors duration-200', active && 'animate-pop text-brand')}
                                />
                                <span className="relative">{vf.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Status rail — scrolls on narrow screens, edges fade instead of clipping hard. */}
            <section className="mt-3 animate-fade-up overflow-hidden rounded-2xl border border-border bg-card px-2 shadow-card [animation-delay:340ms]">
                <div>
                    <div className="flex items-center overflow-x-auto scrollbar-hide [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)]">
                        {STATUS_TABS.filter(tab => !tab.isAgent || isBrandOwner).map((tab) => {
                            const active = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => updateFilter('status', tab.key)}
                                    className={cn(
                                        'group/tab relative flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 text-[13px] transition-colors duration-200',
                                        active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {/* Hover wash, then the gliding yellow underline for the active tab. */}
                                    <span aria-hidden className="absolute inset-x-1 inset-y-2 rounded-xl bg-secondary opacity-0 transition-opacity duration-200 group-hover/tab:opacity-100" />
                                    {active && (
                                        <motion.span
                                            layoutId="campaign-status-rail"
                                            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                            className="absolute inset-x-2.5 bottom-0 h-[3px] rounded-t-full bg-brand"
                                        />
                                    )}
                                    {tab.isAI && <Sparkles className={cn('relative h-3.5 w-3.5', active ? 'text-foreground' : 'text-muted-foreground')} />}
                                    {tab.isAgent && <Users className="relative h-3.5 w-3.5" />}
                                    <span className="relative">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Results line with removable filter chips */}
            {!isLoading && !error && (
                <div className="mt-5 flex animate-fade-up flex-wrap items-center gap-2 [animation-delay:320ms]">
                    <p className="mr-1 text-sm text-muted-foreground">
                        {campaigns.length > 0
                            ? <>Showing <strong className="font-semibold tabular-nums text-foreground">{rangeStart}–{rangeEnd}</strong> of <strong className="font-semibold tabular-nums text-foreground">{meta?.total ?? campaigns.length}</strong> campaigns</>
                            : 'No campaigns to show'}
                    </p>
                    {activeTab !== 'all' && statusLabel && (
                        <FilterChip label={statusLabel} onRemove={() => updateFilter('status', 'all')} />
                    )}
                    {activeVisibility !== 'all' && visibilityLabel && (
                        <FilterChip label={visibilityLabel} onRemove={() => updateFilter('visibility', 'all')} />
                    )}
                    {debouncedSearch && (
                        <FilterChip label={`"${debouncedSearch}"`} onRemove={() => setSearchInput('')} />
                    )}
                </div>
            )}

            {/* Loading — skeletons shaped like the cards, one per item a page holds. */}
            {isLoading && (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: limit }, (_, i) => (
                        <div key={i} className="rounded-[24px] border border-border bg-card p-1.5">
                            <div className="h-32 animate-pulse rounded-[19px] bg-secondary" />
                            <div className="px-1.5 pb-0.5 pt-2.5">
                                <div className="h-3 w-1/2 animate-pulse rounded-full bg-secondary" />
                                <div className="mt-3 h-12 animate-pulse rounded-xl bg-secondary" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && !isLoading && (
                <div className="flex items-center justify-center min-h-[40vh]">
                    <p className="text-sm text-destructive">Failed to load campaigns. Please try again.</p>
                </div>
            )}

            {/* Campaign Grid */}
            {!isLoading && !error && (
                <>
                    {campaigns.length === 0 ? (
                        <div className="mt-5 flex animate-fade-up flex-col items-center rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
                            <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-brand shadow-card">
                                <Megaphone className="h-6 w-6" />
                                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-brand ring-4 ring-card" />
                            </span>
                            <p className="mt-4 font-display text-lg font-semibold tracking-tight">
                                {hasFilters ? 'No campaigns match these filters' : 'No campaigns yet'}
                            </p>
                            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                {hasFilters
                                    ? 'Try another status, clear the search, or start a new campaign.'
                                    : 'Create your first campaign and start receiving applications from creators.'}
                            </p>
                            <div className="mt-5 flex flex-wrap justify-center gap-2">
                                {hasFilters && (
                                    <button
                                        type="button"
                                        onClick={() => { setSearchInput(''); setParams(new URLSearchParams()); }}
                                        className="h-10 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:border-foreground"
                                    >
                                        Clear filters
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => navigate('/campaigns/create?fresh=true')}
                                    className="flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                                >
                                    <Plus className="h-4 w-4 text-brand" />
                                    Create campaign
                                </button>
                            </div>
                        </div>
                    ) : (
                        // Column counts divide the page size of 12, so the last row is always full.
                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {campaigns.map((campaign, i) => (
                                <CampaignCard
                                    key={campaign.id}
                                    campaign={campaign}
                                    listSearch={listSearch}
                                    className={CARD_DELAYS[Math.min(i, CARD_DELAYS.length - 1)]}
                                />
                            ))}
                        </div>
                    )}

                    {/* Pagination — the same pill as the Influencers page. */}
                    {totalPages > 1 && (
                        <nav aria-label="Pages" className="mt-10 flex justify-center">
                            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1.5 shadow-card">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1 || isLoading}
                                    className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium transition-colors enabled:hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground/50"
                                    title="Previous page"
                                >
                                    <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span>
                                </button>
                                {paginationRange.map((p, idx) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${idx}`} className="grid h-9 w-9 place-items-center text-sm text-muted-foreground">…</span>
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
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages || isLoading}
                                    className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium transition-colors enabled:hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground/50"
                                    title="Next page"
                                >
                                    <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </nav>
                    )}
                </>
            )}
        </div>
    );
}

/** Removable chip in the results line for one active filter. */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex animate-pop items-center gap-1 rounded-full bg-foreground py-1 pl-3 pr-1 text-xs font-medium text-background">
            {label}
            <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`} className="grid h-5 w-5 place-items-center rounded-full text-background/70 transition-colors hover:bg-background/15 hover:text-brand">
                <X className="h-3 w-3" />
            </button>
        </span>
    );
}
