import { Fragment, useState, type ComponentProps } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Archive,
    ArrowUpRight,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    Globe,
    Languages,
    Loader2,
    Mail,
    MapPin,
    Megaphone,
    Pencil,
    Plus,
    UserCheck,
    UserPlus,
    UserX,
    Wallet,
    X,
} from 'lucide-react';
import { cn, formatCompactCurrency } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { toast } from 'sonner';
import { useAuthStore } from '@/shared/stores/authStore';
import { useBrandProfiles, useSwitchBrand } from '@/shared/hooks/useBrandProfiles';
import { useBrandDetail, type BrandDetailOwner } from '../hooks/useBrandDetail';
import { useSetTeamMemberStatus, useUnassignTeamMemberBrand } from '../hooks/useTeam';
import { useDeactivateBrand } from '../hooks/useBrandLifecycle';
import { EditBrandModal } from '../components/EditBrandModal';
import { AddTeamMemberModal } from '../components/AddTeamMemberModal';

// Staggered entrance for list rows; Tailwind needs the full class names spelled out.
const ROW_DELAYS = ['[animation-delay:280ms]', '[animation-delay:330ms]', '[animation-delay:380ms]', '[animation-delay:430ms]', '[animation-delay:480ms]'];

// Row inside the "Managers on this brand" card — same row anatomy as the agent
// rows below (avatar initial, name/email, status pill) plus the manager actions.
function ManagerRow({
    manager,
    onRemove,
    isRemoving,
    onToggleStatus,
    isTogglingStatus,
}: {
    manager: BrandDetailOwner;
    onRemove: () => void;
    isRemoving: boolean;
    onToggleStatus: () => void;
    isTogglingStatus: boolean;
}) {
    return (
        <div className="group flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-brand/[0.05]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-2xl bg-brand/15 ring-1 ring-brand/40 flex items-center justify-center font-display text-sm font-bold text-foreground shrink-0 transition-colors group-hover:bg-brand">
                    {manager.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{manager.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{manager.email}</p>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                    'flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-semibold',
                    manager.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground',
                )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', manager.isActive ? 'bg-emerald-500' : 'bg-foreground/25')} />
                    {manager.isActive ? 'Active' : 'Inactive'}
                </span>
                {/* Account-wide activate/deactivate — distinct from the X (which only
                    removes this brand's assignment and leaves the account usable). */}
                <button
                    type="button"
                    onClick={onToggleStatus}
                    disabled={isTogglingStatus}
                    title={manager.isActive ? 'Deactivate this manager account' : 'Reactivate this manager account'}
                    className={cn(
                        'p-1.5 rounded-lg text-muted-foreground transition-premium disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
                        manager.isActive ? 'hover:text-destructive hover:bg-destructive/10' : 'hover:text-green-600 hover:bg-green-500/10',
                    )}
                >
                    {isTogglingStatus ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : manager.isActive ? (
                        <UserX className="w-3.5 h-3.5" />
                    ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={isRemoving}
                    title="Remove from this brand"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-premium disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                    {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                </button>
            </div>
        </div>
    );
}

export default function BrandDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: brand, isLoading } = useBrandDetail(id);
    const { mutate: unassignManager, isPending: isUnassigning, variables: unassigningVariables } = useUnassignTeamMemberBrand();
    const { mutate: setManagerStatus, isPending: isSettingStatus, variables: statusVariables } = useSetTeamMemberStatus();
    const activeBrandId = useAuthStore((s) => s.user?.brandId);
    const { data: brandProfiles = [] } = useBrandProfiles(brand?.relation === 'owned');
    const { mutateAsync: switchBrandAsync } = useSwitchBrand();
    const { mutateAsync: deactivateBrand, isPending: isDeactivating } = useDeactivateBrand();

    const [editOpen, setEditOpen] = useState(false);
    const [addManagerOpen, setAddManagerOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="w-full flex items-center justify-center min-h-[40vh]">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!brand) {
        return (
            <div className="w-full animate-fade-in text-center py-16">
                <p className="text-sm text-muted-foreground">Brand not found, or you don't have access to it.</p>
            </div>
        );
    }

    const handleRemoveManager = (managerId: string) => {
        if (!id) return;
        if (!window.confirm('Remove this manager from the brand? They will lose access immediately.')) return;
        unassignManager(
            { managerId, brandId: id },
            { onError: () => toast.error('Failed to remove manager. Please try again.') },
        );
    };

    const handleToggleManagerStatus = (manager: BrandDetailOwner) => {
        if (!id) return;
        if (
            manager.isActive &&
            !window.confirm(`Deactivate ${manager.name}'s account? They will be unable to log in (on any brand) until reactivated. Their brand assignments are kept.`)
        ) {
            return;
        }
        setManagerStatus(
            { managerId: manager.id, isActive: !manager.isActive, brandId: id },
            { onError: () => toast.error('Failed to update the manager account. Please try again.') },
        );
    };

    // One "Team" for this brand — team members granted access via brand_managers. Managing
    // the team is owner-only; the single Add button invites a team member (works on both the
    // Brand and Agencies plans).
    const isOwned = brand.relation === 'owned';
    // Primary brand = the account's earliest-created owned brand ("Your brand"), which anchors
    // the account and can't be deactivated (the backend rejects it too). brandProfiles is
    // earliest-owned-first, so the first owned entry is the primary.
    const primaryBrandId = brandProfiles.find((b) => b.relation === 'owned')?.id;
    const isPrimaryBrand = isOwned && brand.id === primaryBrandId;
    const teamMembers = isOwned ? brand.managers : [];
    const teamCount = teamMembers.length;
    const handleAddTeam = () => setAddManagerOpen(true);

    const handleDeactivateBrand = async () => {
        if (!id || !brand) return;
        if (
            !window.confirm(
                `Deactivate ${brand.brandName}? Team members on this brand lose access immediately. Campaigns and data are kept, and you can reactivate it any time from Brands.`,
            )
        ) {
            return;
        }
        try {
            // If this is the session's active brand, move the session elsewhere first —
            // otherwise the JWT keeps pointing at the deactivated brand and every
            // subsequent request 403s until the token refreshes.
            if (activeBrandId === id) {
                const fallback = brandProfiles.find((b) => b.id !== id);
                if (!fallback) {
                    toast.error('You cannot deactivate your only active brand.');
                    return;
                }
                await switchBrandAsync(fallback.id);
            }
            await deactivateBrand(id);
            toast.success(`${brand.brandName} deactivated`);
            navigate('/brands');
        } catch (err: any) {
            const message = err?.response?.data?.error?.message;
            toast.error(message || 'Could not deactivate this brand. Please try again.');
        }
    };

    const isCurrentBrand = activeBrandId != null && String(activeBrandId) === String(brand.id);
    const { campaignCount, activeCampaignCount, totalBudget, totalSpent } = brand.campaignStats;
    const livePct = campaignCount > 0 ? Math.round((activeCampaignCount / campaignCount) * 100) : 0;
    const usedPct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;
    const location = [brand.city, brand.state].filter(Boolean).join(', ');
    const website = brand.website?.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const details = [
        website && { icon: Globe, label: 'Website', value: website, href: brand.website!.startsWith('http') ? brand.website! : `https://${brand.website}` },
        brand.contactEmail && { icon: Mail, label: 'Contact', value: brand.contactEmail, href: `mailto:${brand.contactEmail}` },
        location && { icon: MapPin, label: 'Location', value: location },
        brand.primaryLanguage && { icon: Languages, label: 'Language', value: brand.primaryLanguage },
        { icon: CalendarDays, label: 'Added', value: new Date(brand.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
    ].filter(Boolean) as { icon: typeof Globe; label: string; value: string; href?: string }[];

    return (
        <div className="w-full animate-fade-in pb-10">
            {/* ── Hero: a brand passport. Left, the brand as a premium membership card (tilted in 3D,
                straightens with a light sweep on hover). Right, an editorial column: actions, the
                brand's story set as a headline, and its numbers as big airy figures. ── */}
            <section className="mb-5 grid animate-fade-up grid-cols-1 gap-8 rounded-[32px] border border-border bg-card p-5 shadow-card sm:p-7 lg:grid-cols-[360px_minmax(0,1fr)]">
                {/* The card */}
                <div className="flex items-center justify-center [perspective:1100px]">
                    <div className="group/card relative aspect-[1.586] w-full max-w-[360px] overflow-hidden rounded-[26px] border border-brand/40 bg-gradient-to-br from-brand/30 via-brand/10 to-card p-5 shadow-[0_24px_50px_-24px_rgb(250_203_3_/_0.75)] transition-transform duration-700 ease-out [transform:rotateY(-12deg)_rotateX(6deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)]">
                        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/40 blur-3xl" />
                        {/* Light sweep on hover */}
                        <span aria-hidden className="pointer-events-none absolute -inset-y-8 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 transition-all duration-1000 ease-out group-hover/card:left-[120%] group-hover/card:opacity-100" />

                        <div className="relative flex h-full flex-col justify-between">
                            <div className="flex items-start justify-between gap-3">
                                <div className="h-12 w-12 overflow-hidden rounded-2xl bg-card shadow-card ring-2 ring-card">
                                    <ApiImage src={brand.brandLogoUrl} alt={brand.brandName} className="h-full w-full object-cover text-lg" fallbackText={brand.brandName.charAt(0)} />
                                </div>
                                <span className="text-right text-[9px] font-bold uppercase leading-tight tracking-[0.2em] text-foreground/55">
                                    MutinyX<br />{isPrimaryBrand ? 'Your brand' : isOwned ? 'Client brand' : 'Managed brand'}
                                </span>
                            </div>

                            {/* Contact chip, drawn */}
                            <span aria-hidden className="relative h-7 w-10 overflow-hidden rounded-md bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 shadow-inner ring-1 ring-amber-600/30">
                                <span className="absolute inset-x-0 top-1/2 h-px bg-amber-700/30" />
                                <span className="absolute inset-y-0 left-1/3 w-px bg-amber-700/30" />
                                <span className="absolute inset-y-0 left-2/3 w-px bg-amber-700/30" />
                            </span>

                            <div className="flex items-end justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate font-display text-2xl font-semibold leading-tight tracking-tight">{brand.brandName}</p>
                                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55">
                                        Brand since {new Date(brand.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                {isCurrentBrand && (
                                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-foreground px-2 py-1 text-[10px] font-bold text-brand">
                                        <Check className="h-3 w-3 stroke-[3]" /> Active
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* The editorial column */}
                <div className="flex min-w-0 flex-col">
                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/brands?tab=profiles')}
                            className="group/back flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ChevronLeft className="h-4 w-4 transition-transform group-hover/back:-translate-x-0.5" />
                            All brands
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setEditOpen(true)}
                                className="group/edit flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold transition-all hover:border-foreground"
                            >
                                <Pencil className="h-3.5 w-3.5 transition-transform duration-300 group-hover/edit:-rotate-12" />
                                Edit
                            </button>
                            {/* Owner-only "delete" — soft deactivation; a manager viewing an
                                assigned brand can edit it but never retire it. The primary brand
                                anchors the account, so it's never deactivatable. */}
                            {isOwned && !isPrimaryBrand && (
                                <button
                                    type="button"
                                    onClick={handleDeactivateBrand}
                                    disabled={isDeactivating}
                                    title="Deactivate this brand"
                                    className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-[#E50914] hover:text-[#E50914] disabled:opacity-60"
                                >
                                    {isDeactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">Deactivate</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {brand.industry && <span>{brand.industry}</span>}
                        {brand.industry && location && <span className="h-1 w-1 rounded-full bg-brand" />}
                        {location && <span>{location}</span>}
                    </p>
                    {/* The brand's story as a pull quote: a big yellow quote mark, light open type, and
                        the brand's own name picked out with a highlighter stroke. */}
                    <h1 className="relative mt-4 pl-10 font-display text-xl font-normal leading-[1.6] tracking-tight text-foreground/75 sm:pl-12 sm:text-[22px]">
                        <span aria-hidden className="absolute -top-3 left-0 select-none font-display text-6xl font-bold leading-none text-brand sm:text-7xl">&ldquo;</span>
                        {brand.bio
                            ? brand.bio.split(brand.brandName).map((part, i) => (
                                <Fragment key={i}>
                                    {i > 0 && (
                                        <span className="whitespace-nowrap bg-gradient-to-t from-brand/50 from-40% to-transparent to-40% font-semibold text-foreground">
                                            {brand.brandName}
                                        </span>
                                    )}
                                    {part}
                                </Fragment>
                            ))
                            : <span className="font-semibold text-foreground">{brand.brandName}</span>}
                    </h1>

                    {/* The numbers, big and airy */}
                    <dl className="mt-auto grid grid-cols-1 gap-6 pt-8 sm:grid-cols-3">
                        <div>
                            <dd className="font-display text-5xl font-light leading-none tracking-tight tabular-nums">{campaignCount}</dd>
                            <dt className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <Megaphone className="h-3.5 w-3.5" /> Campaigns
                            </dt>
                        </div>
                        <div>
                            <dd className="flex items-baseline gap-2 font-display text-5xl font-light leading-none tracking-tight tabular-nums">
                                {activeCampaignCount}
                                <span className="text-sm font-semibold text-muted-foreground">{livePct}%</span>
                            </dd>
                            <dt className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <span className="relative flex h-1.5 w-1.5">
                                    {activeCampaignCount > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />}
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                                </span>
                                Live now
                            </dt>
                        </div>
                        <div>
                            <dd className="font-display text-5xl font-light leading-none tracking-tight tabular-nums">
                                <span className="mr-0.5 font-sans text-2xl text-muted-foreground">₹</span>{formatCompactCurrency(totalSpent)}
                            </dd>
                            <dt className="mt-2 flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Spent</span>
                                <span>of <strong className="font-semibold text-foreground">₹{formatCompactCurrency(totalBudget)}</strong></span>
                            </dt>
                            <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-2 h-1 w-full overflow-hidden rounded-full" aria-label={`${usedPct}% of budget used`}>
                                <rect x="0" y="0" width="100" height="4" className="fill-foreground/[0.08]" />
                                <rect x="0" y="0" width={usedPct} height="4" className="fill-brand" />
                            </svg>
                        </div>
                    </dl>
                </div>
            </section>

            {/* ── Recent campaigns (left) · team and details (right) ── */}
            <div className="grid grid-cols-12 gap-5">
                <section className="col-span-12 animate-fade-up overflow-hidden rounded-[28px] border border-border bg-card shadow-card [animation-delay:200ms] lg:col-span-7">
                    <div className="flex items-end justify-between gap-3 px-6 pb-4 pt-6">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Portfolio</p>
                            <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">Recent campaigns</h3>
                        </div>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
                            {brand.recentCampaigns.length} shown
                        </span>
                    </div>
                    {brand.recentCampaigns.length === 0 ? (
                        <div className="mx-6 mb-6 grid place-items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand/15 ring-1 ring-brand/40"><Megaphone className="h-4 w-4" /></span>
                            <p className="text-sm font-semibold">No campaigns yet</p>
                            <p className="text-xs text-muted-foreground">Campaigns created for this brand will show up here.</p>
                        </div>
                    ) : (
                        <ul className="border-t border-border">
                            {brand.recentCampaigns.map((campaign, i) => (
                                <li key={campaign.id} className={cn('animate-fade-up border-b border-border last:border-0', ROW_DELAYS[Math.min(i, ROW_DELAYS.length - 1)])}>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/campaigns/${campaign.id}`)}
                                        className="group/row relative flex w-full items-center gap-4 px-6 py-3.5 text-left transition-colors hover:bg-brand/[0.05]"
                                    >
                                        <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] scale-y-0 rounded-r-full bg-brand transition-transform duration-300 group-hover/row:scale-y-100" />
                                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary font-display text-sm font-bold transition-colors group-hover/row:bg-brand">
                                            {campaign.name.charAt(0).toUpperCase()}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold">{campaign.name}</span>
                                            <span className="block text-[11px] text-muted-foreground">
                                                Created {new Date(campaign.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </span>
                                        <span className="hidden text-right sm:block">
                                            <span className="block font-display text-sm font-semibold tabular-nums">₹{formatCompactCurrency(campaign.budgetTotal)}</span>
                                            <span className="block text-[10px] text-muted-foreground">Budget</span>
                                        </span>
                                        <StatusBadge status={campaign.status as ComponentProps<typeof StatusBadge>['status']} />
                                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-foreground" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <div className="col-span-12 flex flex-col gap-5 lg:col-span-5">
                    {/* One Team section — team members granted access to this brand. Owner-only:
                        a team member viewing a brand assigned to them doesn't manage the team. */}
                    {isOwned && (
                        <section className="animate-fade-up overflow-hidden rounded-[28px] border border-border bg-card shadow-card [animation-delay:260ms]">
                            <div className="flex items-end justify-between gap-3 px-6 pb-4 pt-6">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Access</p>
                                    <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">Team</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddTeam}
                                    className="group/add flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground pl-1 pr-3.5 text-xs font-semibold text-background transition-shadow hover:shadow-float"
                                >
                                    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-black transition-transform duration-300 group-hover/add:rotate-90">
                                        <Plus className="h-3.5 w-3.5" />
                                    </span>
                                    Add member
                                </button>
                            </div>
                            {teamCount === 0 ? (
                                <div className="mx-6 mb-6 grid place-items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-8 text-center">
                                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand/15 ring-1 ring-brand/40"><UserPlus className="h-4 w-4" /></span>
                                    <p className="text-sm font-semibold">No team members yet</p>
                                    <p className="text-xs text-muted-foreground">You manage this brand directly.</p>
                                </div>
                            ) : (
                                <div className="border-t border-border px-3 py-2">
                                    {teamMembers.map((manager) => (
                                        <ManagerRow
                                            key={manager.id}
                                            manager={manager}
                                            onRemove={() => handleRemoveManager(manager.id)}
                                            isRemoving={isUnassigning && unassigningVariables?.managerId === manager.id}
                                            onToggleStatus={() => handleToggleManagerStatus(manager)}
                                            isTogglingStatus={isSettingStatus && statusVariables?.managerId === manager.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    <section className="animate-fade-up overflow-hidden rounded-[28px] border border-border bg-card shadow-card [animation-delay:320ms]">
                        <div className="px-6 pb-4 pt-6">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">About</p>
                            <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">Brand details</h3>
                        </div>
                        <dl className="border-t border-border">
                            {details.map((item) => (
                                <div key={item.label} className="flex items-center justify-between gap-4 border-b border-border px-6 py-3 last:border-0">
                                    <dt className="flex shrink-0 items-center gap-2.5 text-xs text-muted-foreground">
                                        <item.icon className="h-3.5 w-3.5" />
                                        {item.label}
                                    </dt>
                                    <dd className="min-w-0 truncate text-right text-[13px] font-semibold">
                                        {item.href ? (
                                            <a href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                                                {item.value}
                                                <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                            </a>
                                        ) : item.value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                </div>
            </div>

            <EditBrandModal brand={brand} open={editOpen} onOpenChange={setEditOpen} />
            <AddTeamMemberModal
                open={addManagerOpen}
                onOpenChange={setAddManagerOpen}
                brandId={brand.id}
                brandName={brand.brandName}
                existingMemberIds={brand.managers.map((m) => m.id)}
            />
        </div>
    );
}
