import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowRightLeft, ArrowUpRight, Building2, Check, Loader2, Megaphone, MoreHorizontal, Plus, Rocket, Search, Sparkles, Trash2, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/shared/components/PageHeader';
import { PageExplainer } from '@/shared/components/PageExplainer';
import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/ui/button';
import { ApiImage } from '@/shared/components/ApiImage';
import { cn, formatCompactCurrency } from '@/lib/utils';
import { useCurrentSubscription } from '@/modules/subscription/hooks/useSubscription';
import { getBrandRoleLabel, useSwitchBrand } from '@/shared/hooks/useBrandProfiles';
import { useIsAgencyOwner } from '@/shared/hooks/useIsAgencyOwner';
import { useAuthStore } from '@/shared/stores/authStore';
import { useAgencyOverview } from '../hooks/useAgencyOverview';
import { coverTint } from '../components/brandCover';
import { useDeactivatedBrands, useDeactivateBrand, useReactivateBrand } from '../hooks/useBrandLifecycle';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

// Staggered entrance for brand cards (same rhythm as the Teams page); Tailwind needs the full class names spelled out.
const CARD_DELAYS = ['[animation-delay:0ms]', '[animation-delay:60ms]', '[animation-delay:120ms]', '[animation-delay:180ms]', '[animation-delay:240ms]', '[animation-delay:300ms]', '[animation-delay:360ms]', '[animation-delay:420ms]'];
const cardDelay = (i: number) => CARD_DELAYS[Math.min(i, CARD_DELAYS.length - 1)];

// One button system for the page: a black pill for the single primary action, soft pills everywhere else.
const primaryButton = 'flood-btn group flex h-10 items-center gap-2 rounded-full bg-foreground pl-2 pr-2 text-[13px] font-semibold text-background shadow-sm duration-300 ease-out hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.97] sm:pr-4';
const softPill = 'flex h-8 items-center gap-1.5 rounded-full border border-foreground/10 bg-card px-3 text-[11px] font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-transparent hover:bg-brand active:translate-y-0 active:scale-[0.97] disabled:opacity-60';
const statTile = 'group flex animate-fade-up flex-col justify-between gap-5 rounded-3xl p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float';

type BrandFilter = 'all' | 'live' | 'idle';

// Circumference of the Live-now ring (r = 22).
const LIVE_RING_LENGTH = 2 * Math.PI * 22;

/** One bar per brand (up to 7); the tallest is yellow. Heights are SVG attributes, not inline styles. */
function BrandBars({ values, label }: { values: { id: string; name: string; value: number }[]; label: string }) {
    const max = Math.max(0, ...values.map((v) => v.value));
    return (
        <svg viewBox="0 0 76 44" className="h-11 w-[68px]" aria-label={label}>
            {values.slice(0, 7).map((v, i) => {
                const h = max > 0 ? Math.max(4, (v.value / max) * 42) : 4;
                const isTop = max > 0 && v.value === max;
                return (
                    <rect key={v.id} x={i * 11} y={44 - h} width="7" height={h} rx="2" className={v.value === 0 ? 'fill-foreground/10' : isTop ? 'fill-brand' : 'fill-foreground/70'}>
                        <title>{`${v.name}: ${v.value}`}</title>
                    </rect>
                );
            })}
        </svg>
    );
}

/** Thin stacked bar: each brand's share of total spend, biggest first in yellow. */
function SpendShare({ values }: { values: { id: string; name: string; value: number }[] }) {
    const total = values.reduce((sum, v) => sum + v.value, 0);
    const sorted = [...values].filter((v) => v.value > 0).sort((a, b) => b.value - a.value);
    const fills = ['fill-brand', 'fill-foreground/70', 'fill-foreground/40', 'fill-foreground/20'];
    let x = 0;
    return (
        <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="h-1.5 w-full overflow-hidden rounded-full" aria-label="Share of spend by brand">
            <rect x="0" y="0" width="100" height="6" className="fill-foreground/[0.07]" />
            {total > 0 && sorted.map((v, i) => {
                const w = (v.value / total) * 100;
                const rect = (
                    <rect key={v.id} x={x} y="0" width={w} height="6" className={fills[Math.min(i, fills.length - 1)]}>
                        <title>{`${v.name}: ${Math.round((v.value / total) * 100)}%`}</title>
                    </rect>
                );
                x += w;
                return rect;
            })}
        </svg>
    );
}

export default function BrandsPage() {
    const navigate = useNavigate();
    const currentBrandId = useAuthStore((state) => state.user?.brandId);
    const { isAgencyOwner, isBrandOwner } = useIsAgencyOwner();
    const { isLoading: isLoadingSubscription } = useCurrentSubscription(isBrandOwner);
    const { data, isLoading } = useAgencyOverview(isAgencyOwner);
    const { mutate: switchBrand, isPending: isSwitching, variables: switchingBrandId } = useSwitchBrand();
    const { data: deactivatedBrands = [] } = useDeactivatedBrands(isAgencyOwner);
    const { mutate: reactivateBrand, isPending: isReactivating, variables: reactivatingBrandId } = useReactivateBrand();
    const { mutateAsync: deactivateBrand, isPending: isDeactivating } = useDeactivateBrand();

    const [filter, setFilter] = useState<BrandFilter>('all');
    const [query, setQuery] = useState('');

    const brands = useMemo(() => data?.brands ?? [], [data]);
    const totalSpentAcrossBrands = useMemo(() => brands.reduce((sum, b) => sum + (b.totalSpent || 0), 0), [brands]);
    const topSpender = useMemo(() => brands.reduce<(typeof brands)[number] | null>((top, b) => (!top || (b.totalSpent || 0) > (top.totalSpent || 0) ? b : top), null), [brands]);

    if (isLoadingSubscription) {
        return (
            <div className="w-full flex items-center justify-center min-h-[40vh]">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!isAgencyOwner) {
        const perks = [
            'Add and manage unlimited client brands',
            'Switch into any brand in one click',
            'Assign managers with brand-scoped access',
            'Deactivate and reactivate brands without losing history',
        ];
        return (
            <div className="w-full animate-fade-in">
                <PageHeader title="Brands" description="Manage every brand under your Agencies account." infoTooltip="Client Brands lets Agencies run multiple brands from one login." />
                <div className="grid grid-cols-1 lg:grid-cols-5 rounded-2xl overflow-hidden bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_-8px_rgba(0,0,0,0.12)]">
                    <div className="lg:col-span-3 p-8 sm:p-10 flex flex-col justify-center">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-black bg-[#fedc03] w-fit px-2.5 py-1 rounded-full mb-5">
                            <Sparkles className="w-3 h-3" /> Agencies plan
                        </span>
                        <h2 className="text-2xl font-bold font-display mb-2 leading-tight">Run every client brand from one login</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-md">
                            Upgrade to Agencies to add unlimited client brands, switch between them instantly, and give your team scoped access — without juggling separate accounts.
                        </p>
                        <ul className="space-y-3 mb-8">
                            {perks.map((line) => (
                                <li key={line} className="flex items-start gap-2.5 text-sm">
                                    <span className="w-4 h-4 rounded-full bg-[#fedc03]/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="w-2.5 h-2.5 text-foreground" />
                                    </span>
                                    {line}
                                </li>
                            ))}
                        </ul>
                        <Button onClick={() => navigate('/subscription')} className="w-fit">View Agencies plans</Button>
                    </div>
                    <div className="lg:col-span-2 relative bg-[#0a0a0a] p-8 sm:p-10 flex items-center justify-center min-h-[280px]">
                        <div className="relative w-full max-w-[200px]">
                            {[2, 1].map((i) => (
                                <div
                                    key={i}
                                    className="absolute inset-x-0 rounded-2xl border border-white/10 bg-white/[0.05]"
                                    style={{ top: -14 * i, transform: `scale(${1 - i * 0.05})`, zIndex: i, opacity: 1 - i * 0.3, height: 68 }}
                                />
                            ))}
                            <div className="relative z-10 rounded-2xl border border-white/15 bg-white/[0.09] p-4 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#fedc03]/90 flex items-center justify-center shrink-0">
                                        <Building2 className="w-4 h-4 text-black" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="h-2 w-20 rounded-full bg-white/30 mb-1.5" />
                                        <div className="h-1.5 w-14 rounded-full bg-white/15" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const q = query.trim().toLowerCase();
    const visibleBrands = brands.filter((b) => {
        if (filter === 'live' && b.activeCampaignCount === 0) return false;
        if (filter === 'idle' && b.activeCampaignCount > 0) return false;
        return !q || b.brandName.toLowerCase().includes(q) || (b.industry ?? '').toLowerCase().includes(q);
    });
    const liveBrandCount = brands.filter((b) => b.activeCampaignCount > 0).length;
    const currentBrand = brands.find((b) => currentBrandId != null && String(b.id) === String(currentBrandId)) ?? null;
    const switchTo = (brandId: string) =>
        switchBrand(brandId, { onError: () => toast.error('Failed to switch brand. Please try again.') });
    const handleDeactivate = async (brand: (typeof brands)[number]) => {
        if (!window.confirm(
            `Deactivate ${brand.brandName}? Team members on this brand lose access immediately. Campaigns and data are kept, and you can reactivate it any time.`
        )) return;
        try {
            await deactivateBrand(brand.id);
            toast.success(`${brand.brandName} deactivated`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '';
            toast.error(message || 'Could not deactivate this brand. Please try again.');
        }
    };

    return (
        <>
        {/* Full-screen loader while a brand switch is in flight */}
        {isSwitching && (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm animate-fade-in">
                <Loader2 className="w-8 h-8 animate-spin text-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Switching brand…</p>
            </div>
        )}
        <div className="w-full animate-fade-in pb-10">
            <PageHeader
                title="Brands"
                description="Every brand under your Agencies account."
                animated
                size="lg"
                infoTooltip="Every client brand under your Agencies account — switch between them or open one to manage it. See the card below for how brands work."
                actions={
                    <button type="button" onClick={() => navigate('/brands/new')} className={primaryButton}>
                        <span className="flood-btn-icon grid h-6 w-6 place-items-center rounded-full bg-brand text-foreground">
                            <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />
                        </span>
                        <span className="flood-btn-label hidden sm:inline">Add new brand</span>
                    </button>
                }
            />

            <PageExplainer
                label="What are Client Brands?"
                description="Your Agencies account lets you run every client brand from one login. Add a brand, switch into it in a click, and give team members access scoped to just that brand."
                dismissKey="mutiny:explainer:brands"
                steps={[
                    { icon: Building2, title: 'Add a brand', description: 'Create a brand profile for each client you manage.', motion: 'build' },
                    { icon: ArrowRightLeft, title: 'Switch instantly', description: 'Jump into any brand in one click — no separate logins.', motion: 'switch' },
                    { icon: Archive, title: 'Deactivate safely', description: 'Pause a brand without losing its campaigns or history.', motion: 'archive' },
                ]}
            />

            {isLoading || !data ? (
                <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 h-[220px] animate-pulse rounded-3xl bg-secondary/60 lg:col-span-5" />
                    <div className="col-span-12 h-[220px] animate-pulse rounded-3xl bg-secondary/60 lg:col-span-7" />
                </div>
            ) : (
                <>
                    {/* ── Bento: the brand you're in (spotlight) beside three numbers, each with its own visual ── */}
                    <div className="mb-8 grid grid-cols-12 gap-4">
                        <section className="group relative col-span-12 flex animate-fade-up flex-col overflow-hidden rounded-3xl border border-foreground/[0.08] bg-card shadow-card lg:col-span-5">
                            <div className={cn('relative h-24 overflow-hidden bg-gradient-to-br', currentBrand ? coverTint(currentBrand.id) : 'from-brand/30 to-brand/5')}>
                                {currentBrand?.brandLogoUrl && (
                                    <ApiImage src={currentBrand.brandLogoUrl} alt="" className="absolute inset-0 h-full w-full scale-150 object-cover opacity-40 blur-3xl saturate-150" fallbackText="" />
                                )}
                                <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(rgb(0_0_0)_1px,transparent_1px)] [background-size:16px_16px]" />
                                <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-card/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] shadow-sm backdrop-blur">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                                    </span>
                                    You're working in
                                </span>
                                <span className="absolute right-4 top-4 rounded-full bg-card/85 px-2.5 py-1 text-[11px] font-semibold tabular-nums shadow-sm backdrop-blur">
                                    {data.totals.brandCount} {data.totals.brandCount === 1 ? 'brand' : 'brands'}
                                </span>
                            </div>

                            <div className="relative flex flex-1 flex-col gap-4 px-5 pb-5">
                                <div className="-mt-8 flex items-end gap-3">
                                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-secondary shadow-float ring-4 ring-card">
                                        {currentBrand ? (
                                            <ApiImage src={currentBrand.brandLogoUrl} alt={currentBrand.brandName} className="h-full w-full object-cover" fallbackText={currentBrand.brandName.charAt(0)} />
                                        ) : (
                                            <span className="grid h-full w-full place-items-center"><Building2 className="h-6 w-6 text-muted-foreground" /></span>
                                        )}
                                    </div>
                                    <div className="min-w-0 pb-1">
                                        <p className="truncate font-display text-xl font-semibold tracking-tight">{currentBrand?.brandName ?? 'No brand selected'}</p>
                                        <p className="truncate text-xs text-muted-foreground">{currentBrand?.industry || 'Switch into a brand below'}</p>
                                    </div>
                                </div>

                                {currentBrand && (
                                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-4 text-xs">
                                            <span><strong className="font-display text-base font-semibold tabular-nums">{currentBrand.campaignCount}</strong> <span className="text-muted-foreground">campaigns</span></span>
                                            <span><strong className="font-display text-base font-semibold tabular-nums">{currentBrand.activeCampaignCount}</strong> <span className="text-muted-foreground">live</span></span>
                                        </div>
                                        <button type="button" onClick={() => navigate(`/brands/${currentBrand.id}`)} className={cn(softPill, 'group/open')}>
                                            Open brand
                                            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/open:-translate-y-px group-hover/open:translate-x-px" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-7">
                            {/* Campaigns — bars per brand */}
                            <div className={cn(statTile, 'border border-foreground/[0.08] bg-card', cardDelay(1))}>
                                <span className="flex items-center gap-2 text-[13px] font-semibold">
                                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-secondary"><Megaphone className="h-3.5 w-3.5" /></span>
                                    Campaigns
                                </span>
                                <div className="flex items-end justify-between gap-3">
                                    <p className="font-display text-4xl font-semibold leading-none tracking-tight tabular-nums">{data.totals.campaignCount}</p>
                                    <BrandBars values={brands.map((b) => ({ id: b.id, name: b.brandName, value: b.campaignCount }))} label="Campaigns per brand" />
                                </div>
                                <p className="border-t border-border pt-2.5 text-[11px] font-medium text-muted-foreground">Across every brand</p>
                            </div>

                            {/* Live now — the one yellow tile */}
                            <div className={cn(statTile, 'relative overflow-hidden bg-brand', cardDelay(2))}>
                                <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgb(0_0_0)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                                <span className="relative flex items-center gap-2 text-[13px] font-semibold">
                                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-card/70"><Rocket className="h-3.5 w-3.5" /></span>
                                    Live now
                                </span>
                                <div className="relative flex items-end justify-between gap-3">
                                    <p className="font-display text-4xl font-semibold leading-none tracking-tight tabular-nums">{data.totals.activeCampaignCount}</p>
                                    <span className="relative grid h-11 w-11 place-items-center">
                                        <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden>
                                            <circle cx="28" cy="28" r="22" fill="none" strokeWidth="6" className="stroke-foreground/10" />
                                            <circle
                                                cx="28" cy="28" r="22" fill="none" strokeWidth="6" strokeLinecap="round"
                                                strokeDasharray={LIVE_RING_LENGTH}
                                                strokeDashoffset={LIVE_RING_LENGTH * (1 - (data.totals.campaignCount > 0 ? data.totals.activeCampaignCount / data.totals.campaignCount : 0))}
                                                className="stroke-foreground transition-[stroke-dashoffset] [transition-duration:1200ms] ease-out"
                                            />
                                        </svg>
                                        <span className="relative text-[10px] font-bold tabular-nums">
                                            {data.totals.campaignCount > 0 ? Math.round((data.totals.activeCampaignCount / data.totals.campaignCount) * 100) : 0}%
                                        </span>
                                    </span>
                                </div>
                                <p className="relative border-t border-foreground/15 pt-2.5 text-[11px] font-medium text-foreground/60">
                                    {liveBrandCount} of {brands.length} brands running
                                </p>
                            </div>

                            {/* Spent — share by brand */}
                            <div className={cn(statTile, 'border border-foreground/[0.08] bg-card', cardDelay(3))}>
                                <span className="flex items-center gap-2 text-[13px] font-semibold">
                                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-secondary"><Wallet className="h-3.5 w-3.5" /></span>
                                    Spent
                                </span>
                                <div>
                                    <p className="font-display text-4xl font-semibold leading-none tracking-tight tabular-nums">
                                        <span className="mr-0.5 text-2xl text-muted-foreground">₹</span>{formatCompactCurrency(totalSpentAcrossBrands)}
                                    </p>
                                    <div className="mt-3">
                                        <SpendShare values={brands.map((b) => ({ id: b.id, name: b.brandName, value: b.totalSpent || 0 }))} />
                                    </div>
                                </div>
                                <p className="truncate border-t border-border pt-2.5 text-[11px] font-medium text-muted-foreground">
                                    {topSpender && topSpender.totalSpent > 0
                                        ? <>Most by <strong className="font-semibold text-foreground">{topSpender.brandName}</strong></>
                                        : 'Nothing spent yet'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── Toolbar: title · segmented filter · search ── */}
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2.5">
                            <h3 className="font-display text-lg font-semibold tracking-tight">All brands</h3>
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{brands.length}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div role="tablist" aria-label="Filter brands" className="flex h-9 items-center rounded-full border border-foreground/[0.08] bg-card p-1 shadow-sm">
                                {([
                                    { key: 'all', label: 'All', count: brands.length },
                                    { key: 'live', label: 'Live', count: liveBrandCount },
                                    { key: 'idle', label: 'Idle', count: brands.length - liveBrandCount },
                                ] as const).map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={filter === tab.key}
                                        onClick={() => setFilter(tab.key)}
                                        className={cn(
                                            'flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all duration-200',
                                            filter === tab.key ? 'bg-brand text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {tab.key === 'live' && <span className={cn('h-1.5 w-1.5 rounded-full', filter === 'live' ? 'bg-foreground' : 'bg-brand')} />}
                                        {tab.label}
                                        <span className="tabular-nums opacity-60">{tab.count}</span>
                                    </button>
                                ))}
                            </div>
                            <label className="group/search flex h-9 w-full items-center gap-2 rounded-full border border-foreground/[0.08] bg-card px-3 shadow-sm transition-colors focus-within:border-foreground/30 sm:w-56">
                                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-focus-within/search:text-foreground" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search brands…"
                                    aria-label="Search brands"
                                    autoComplete="off"
                                    className="w-full bg-transparent text-xs placeholder:text-muted-foreground/80 focus:outline-none"
                                />
                                {query && (
                                    <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:text-foreground">
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </label>
                        </div>
                    </div>

                    {brands.length === 0 ? (
                        <div className="rounded-3xl border border-border bg-card shadow-card">
                            <EmptyState
                                icon={Building2}
                                title="No brands yet"
                                description="Add one to start managing it under your Agencies account."
                                action={{ label: 'Add new brand', onClick: () => navigate('/brands/new') }}
                            />
                        </div>
                    ) : visibleBrands.length === 0 ? (
                        <div className="grid place-items-center gap-2 rounded-3xl border-2 border-dashed border-foreground/10 px-6 py-12 text-center">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"><Search className="h-4 w-4 text-muted-foreground" /></span>
                            <p className="text-sm font-semibold">No brands match</p>
                            <button type="button" onClick={() => { setQuery(''); setFilter('all'); }} className={softPill}>Clear filters</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {visibleBrands.map((brand, index) => {
                                const isThisOneSwitching = isSwitching && switchingBrandId === brand.id;
                                // The primary brand (earliest-created owned brand — "Your brand") anchors the
                                // account and cannot be deactivated; the backend rejects it too, this just hides
                                // the action. Managed brands are never primary. Uses the unfiltered position.
                                const brandIndex = brands.indexOf(brand);
                                const isPrimaryBrand = brandIndex === 0 && brand.relation !== 'managed';
                                // The brand you're working in gets a yellow ring (`isActive` only means "not deactivated").
                                const current = currentBrandId != null && String(brand.id) === String(currentBrandId);
                                const live = brand.activeCampaignCount;
                                const liveShare = brand.campaignCount > 0 ? live / brand.campaignCount : 0;
                                return (
                                    <article
                                        key={brand.id}
                                        onClick={() => navigate(`/brands/${brand.id}`)}
                                        className={cn(
                                            'group relative flex animate-fade-up cursor-pointer flex-col overflow-hidden rounded-2xl bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float',
                                            current ? 'ring-2 ring-brand' : 'border border-foreground/[0.08] hover:border-foreground/20',
                                            cardDelay(index + 4),
                                        )}
                                    >
                                        {/* Cover: the brand's own logo, blurred over its tint */}
                                        <div className={cn('relative h-14 overflow-hidden bg-gradient-to-br', coverTint(brand.id))}>
                                            {brand.brandLogoUrl && (
                                                <ApiImage
                                                    src={brand.brandLogoUrl}
                                                    alt=""
                                                    className="absolute inset-0 h-full w-full scale-150 object-cover opacity-40 blur-2xl saturate-150 transition-transform duration-700 group-hover:scale-[1.7]"
                                                    fallbackText=""
                                                />
                                            )}
                                            <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(rgb(0_0_0)_1px,transparent_1px)] [background-size:14px_14px]" />

                                            <span
                                                className={cn(
                                                    'absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-card/85 px-2 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur',
                                                    live > 0 ? 'text-foreground' : 'text-muted-foreground',
                                                )}
                                            >
                                                <span className={cn('h-1.5 w-1.5 rounded-full', live > 0 ? 'animate-pulse bg-brand ring-2 ring-brand/30' : 'bg-foreground/25')} />
                                                {live > 0 ? `${live} live` : 'Idle'}
                                            </span>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => e.stopPropagation()}
                                                        aria-label={`More actions for ${brand.brandName}`}
                                                        className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-card/85 text-foreground/70 shadow-sm backdrop-blur transition-colors hover:bg-card hover:text-foreground"
                                                    >
                                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-44">
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/brands/${brand.id}`); }}>
                                                        <ArrowUpRight className="mr-2 h-3.5 w-3.5" />
                                                        Open
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        disabled={current || isThisOneSwitching}
                                                        onClick={(e) => { e.stopPropagation(); switchTo(brand.id); }}
                                                    >
                                                        {isThisOneSwitching ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />}
                                                        {current ? 'Current brand' : 'Switch'}
                                                    </DropdownMenuItem>
                                                    {!isPrimaryBrand && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                disabled={isDeactivating}
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={(e) => { e.stopPropagation(); void handleDeactivate(brand); }}
                                                            >
                                                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                                Deactivate
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="relative flex flex-1 flex-col gap-2.5 px-4 pb-3.5">
                                            <div className="-mt-5 flex items-end gap-2.5">
                                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-secondary shadow-card ring-[3px] ring-card transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
                                                    <ApiImage src={brand.brandLogoUrl} alt={brand.brandName} className="h-full w-full object-cover" fallbackText={brand.brandName.charAt(0)} />
                                                </div>
                                                {current && (
                                                    <span className="mb-0.5 flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold">
                                                        <Check className="h-2.5 w-2.5 stroke-[3]" /> Current
                                                    </span>
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <p className="truncate font-display text-sm font-semibold tracking-tight">{brand.brandName}</p>
                                                <div className="mt-0.5 flex items-center gap-1.5">
                                                    <span
                                                        className={cn(
                                                            'shrink-0 rounded-full px-2 py-px text-[10px] font-semibold',
                                                            brand.relation === 'managed' ? 'bg-secondary text-foreground/70' : isPrimaryBrand ? 'bg-brand/25 text-foreground' : 'border border-border text-foreground/70',
                                                        )}
                                                    >
                                                        {getBrandRoleLabel(brand, brandIndex)}
                                                    </span>
                                                    {brand.industry && <span className="truncate text-[11px] text-muted-foreground">{brand.industry}</span>}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <p className="font-display text-lg font-semibold tabular-nums">
                                                        <span className="mr-0.5 text-xs text-muted-foreground">₹</span>{formatCompactCurrency(brand.totalSpent)}
                                                        <span className="ml-1 font-sans text-[11px] font-medium text-muted-foreground">spent</span>
                                                    </p>
                                                    <p className="text-[11px] font-medium tabular-nums text-muted-foreground">
                                                        <strong className="font-semibold text-foreground">{live}</strong>/{brand.campaignCount} live
                                                    </p>
                                                </div>
                                                <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-1.5 h-1 w-full overflow-hidden rounded-full" aria-label={`${live} of ${brand.campaignCount} campaigns live`}>
                                                    <rect x="0" y="0" width="100" height="4" className="fill-foreground/[0.07]" />
                                                    <rect x="0" y="0" width={liveShare * 100} height="4" className="fill-brand" />
                                                </svg>
                                            </div>

                                            <div className="mt-auto grid grid-cols-2 gap-2 pt-0.5">
                                                {current ? (
                                                    <span className="flex h-7 items-center justify-center gap-1.5 rounded-full bg-brand/15 text-[11px] font-semibold">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                                                        Working here
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isThisOneSwitching}
                                                        onClick={(e) => { e.stopPropagation(); switchTo(brand.id); }}
                                                        className={cn(softPill, 'h-7 justify-center')}
                                                    >
                                                        {isThisOneSwitching ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightLeft className="h-3 w-3" />}
                                                        {isThisOneSwitching ? 'Switching…' : 'Switch'}
                                                    </button>
                                                )}
                                                <span className="flex h-7 items-center justify-center gap-1 rounded-full bg-secondary text-[11px] font-semibold transition-colors duration-200 group-hover:bg-foreground group-hover:text-background">
                                                    Open
                                                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px" />
                                                </span>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}

                            {/* Closing tile: add another brand */}
                            {filter === 'all' && !q && (
                                <button
                                    type="button"
                                    onClick={() => navigate('/brands/new')}
                                    className={cn(
                                        'group relative flex min-h-[176px] animate-fade-up flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-foreground/15 text-muted-foreground transition-all duration-300 hover:border-brand hover:text-foreground',
                                        cardDelay(visibleBrands.length + 4),
                                    )}
                                >
                                    <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand/0 to-brand/0 transition-colors duration-300 group-hover:from-brand/[0.08] group-hover:to-transparent" />
                                    <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-secondary transition-all duration-300 group-hover:scale-110 group-hover:bg-brand group-hover:text-foreground">
                                        <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
                                    </span>
                                    <span className="relative text-sm font-semibold">Add a brand</span>
                                    <span className="relative text-[11px]">Run another client from this login</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Deactivated brands — owner-only recovery list. These live outside the accessible set
                        (no switching, no detail page), so reactivation is the only action offered here. */}
                    {deactivatedBrands.length > 0 && (
                        <section className="mt-10">
                            <div className="mb-3 flex items-center gap-2.5">
                                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/20"><Archive className="h-3.5 w-3.5 text-foreground" /></span>
                                <h3 className="font-display text-base font-semibold tracking-tight">Deactivated</h3>
                                <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold tabular-nums text-background">{deactivatedBrands.length}</span>
                                <span className="hidden text-xs text-muted-foreground sm:inline">· Campaigns and history are kept</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {deactivatedBrands.map((brand) => {
                                    const isThisOneReactivating = isReactivating && reactivatingBrandId === brand.id;
                                    return (
                                        <div key={brand.id} className="group relative flex animate-fade-up items-center justify-between gap-3 overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card px-4 py-3 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-float">
                                            {/* Thin yellow strip on the left marks it as paused, not gone */}
                                            <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-brand" />
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-secondary opacity-70 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0">
                                                    <ApiImage src={brand.brandLogoUrl} alt={brand.brandName} className="h-full w-full object-cover" fallbackText={brand.brandName.charAt(0)} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="flex min-w-0 items-center gap-2">
                                                        <span className="truncate text-sm font-semibold">{brand.brandName}</span>
                                                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                                                            Paused
                                                        </span>
                                                    </p>
                                                    <p className="truncate text-[11px] text-muted-foreground">
                                                        Since {new Date(brand.deactivatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        {brand.industry ? ` · ${brand.industry}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={isThisOneReactivating}
                                                onClick={() =>
                                                    reactivateBrand(brand.id, {
                                                        onSuccess: () => toast.success(`${brand.brandName} reactivated`),
                                                        onError: () => toast.error('Failed to reactivate this brand. Please try again.'),
                                                    })
                                                }
                                                className={cn(softPill, 'restore-btn shrink-0 border-transparent bg-brand/20 hover:bg-brand')}
                                            >
                                                {isThisOneReactivating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArchiveRestore className="restore-icon h-3 w-3 overflow-visible" />}
                                                Reactivate
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
        </>
    );
}
