import { useState, type ComponentProps } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Archive,
    CalendarDays,
    Check,
    ChevronLeft,
    Globe,
    Languages,
    Loader2,
    Mail,
    MapPin,
    Megaphone,
    Pencil,
    Rocket,
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
import { coverTint } from '../components/brandCover';

// Circumference of the Live-now ring (r = 22).
const RING_LENGTH = 2 * Math.PI * 22;

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
        <div className="group flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-secondary/60">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-brand/20 ring-2 ring-card flex items-center justify-center font-display text-sm font-bold text-foreground shrink-0">
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
                    manager.isActive ? 'bg-secondary text-foreground' : 'bg-muted text-muted-foreground',
                )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', manager.isActive ? 'bg-brand' : 'bg-foreground/25')} />
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
                        'p-1.5 rounded-lg text-muted-foreground transition-premium disabled:opacity-50',
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
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-premium disabled:opacity-50"
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
            {/* ── Hero: the brand's own cover (blurred logo over its tint), logo overlapping, actions on the cover ── */}
            <section className="relative mb-5 animate-fade-up overflow-hidden rounded-3xl border border-foreground/[0.08] bg-card shadow-card">
                <div className={cn('relative h-36 overflow-hidden bg-gradient-to-br', coverTint(brand.id))}>
                    {brand.brandLogoUrl && (
                        <ApiImage
                            src={brand.brandLogoUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full scale-150 object-cover opacity-40 blur-3xl saturate-150"
                            fallbackText=""
                        />
                    )}
                    <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(rgb(0_0_0)_1px,transparent_1px)] [background-size:16px_16px]" />

                    <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/brands?tab=profiles')}
                            title="Back to Brands"
                            className="flex h-9 items-center gap-1 rounded-full bg-card/80 pl-2 pr-3.5 text-xs font-semibold shadow-sm backdrop-blur transition-all hover:-translate-x-0.5 hover:bg-card"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Brands
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setEditOpen(true)}
                                className="flex h-9 items-center gap-1.5 rounded-full bg-card/80 px-3.5 text-xs font-semibold shadow-sm backdrop-blur transition-colors hover:bg-brand"
                            >
                                <Pencil className="h-3.5 w-3.5" />
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
                                    className="flex h-9 items-center gap-1.5 rounded-full bg-card/80 px-3.5 text-xs font-semibold text-destructive shadow-sm backdrop-blur transition-colors hover:bg-destructive hover:text-white disabled:opacity-60"
                                >
                                    {isDeactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">Deactivate</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="relative flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="-mt-12 h-24 w-24 shrink-0 animate-pop overflow-hidden rounded-3xl bg-secondary shadow-float ring-4 ring-card [animation-delay:150ms]">
                            <ApiImage src={brand.brandLogoUrl} alt={brand.brandName} className="h-full w-full object-cover text-3xl" fallbackText={brand.brandName.charAt(0)} />
                        </div>
                        <div className="min-w-0 pb-0.5">
                            <h1 className="truncate font-display text-3xl font-semibold tracking-tight animate-slide-in-left [animation-delay:120ms]">{brand.brandName}</h1>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 animate-slide-in-left [animation-delay:200ms]">
                                {isCurrentBrand && (
                                    <span className="flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold">
                                        <Check className="h-3 w-3 stroke-[3]" /> Current brand
                                    </span>
                                )}
                                <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-foreground/70">
                                    {isPrimaryBrand ? 'Your brand' : isOwned ? 'Client brand' : 'Managed'}
                                </span>
                                {brand.industry && (
                                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{brand.industry}</span>
                                )}
                                {location && (
                                    <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{location}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {brand.bio && <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground sm:text-right">{brand.bio}</p>}
                </div>
            </section>

            {/* ── Numbers: campaigns · live (the one yellow tile) · budget used, spanning two columns ── */}
            <div className="mb-5 grid grid-cols-12 gap-4">
                <div className="col-span-6 flex animate-fade-up flex-col justify-between gap-5 rounded-3xl border border-foreground/[0.08] bg-card p-5 shadow-card [animation-delay:60ms] lg:col-span-3">
                    <span className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-secondary"><Megaphone className="h-3.5 w-3.5" /></span>
                        Campaigns
                    </span>
                    <div>
                        <p className="font-display text-4xl font-semibold leading-none tracking-tight tabular-nums">{campaignCount}</p>
                        <p className="mt-2 text-[11px] font-medium text-muted-foreground">Created for this brand</p>
                    </div>
                </div>

                <div className="relative col-span-6 flex animate-fade-up flex-col justify-between gap-5 overflow-hidden rounded-3xl bg-brand p-5 shadow-card [animation-delay:120ms] lg:col-span-3">
                    <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgb(0_0_0)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                    <span className="relative flex items-center gap-2 text-[13px] font-semibold">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-card/70"><Rocket className="h-3.5 w-3.5" /></span>
                        Live now
                    </span>
                    <div className="relative flex items-end justify-between gap-3">
                        <div>
                            <p className="font-display text-4xl font-semibold leading-none tracking-tight tabular-nums">{activeCampaignCount}</p>
                            <p className="mt-2 text-[11px] font-medium text-foreground/60">{livePct}% of campaigns</p>
                        </div>
                        <span className="relative grid h-11 w-11 place-items-center">
                            <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden>
                                <circle cx="28" cy="28" r="22" fill="none" strokeWidth="6" className="stroke-foreground/10" />
                                <circle
                                    cx="28" cy="28" r="22" fill="none" strokeWidth="6" strokeLinecap="round"
                                    strokeDasharray={RING_LENGTH}
                                    strokeDashoffset={RING_LENGTH * (1 - livePct / 100)}
                                    className="stroke-foreground transition-[stroke-dashoffset] [transition-duration:1200ms] ease-out"
                                />
                            </svg>
                        </span>
                    </div>
                </div>

                <div className="col-span-12 flex animate-fade-up flex-col justify-between gap-5 rounded-3xl border border-foreground/[0.08] bg-card p-5 shadow-card [animation-delay:180ms] lg:col-span-6">
                    <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[13px] font-semibold">
                            <span className="grid h-8 w-8 place-items-center rounded-xl bg-secondary"><Wallet className="h-3.5 w-3.5" /></span>
                            Budget
                        </span>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold tabular-nums">{usedPct}% used</span>
                    </div>
                    <div>
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <p className="font-display text-4xl font-semibold leading-none tracking-tight tabular-nums">
                                    <span className="mr-0.5 text-2xl text-muted-foreground">₹</span>{formatCompactCurrency(totalSpent)}
                                </p>
                                <p className="mt-2 text-[11px] font-medium text-muted-foreground">Spent so far</p>
                            </div>
                            <div className="text-right">
                                <p className="font-display text-lg font-semibold tabular-nums">₹{formatCompactCurrency(totalBudget)}</p>
                                <p className="text-[11px] font-medium text-muted-foreground">Total budget</p>
                            </div>
                        </div>
                        <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="mt-4 h-2 w-full overflow-hidden rounded-full" aria-label={`${usedPct}% of budget used`}>
                            <rect x="0" y="0" width="100" height="8" className="fill-foreground/[0.07]" />
                            <rect x="0" y="0" width={usedPct} height="8" className="fill-brand" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* ── Recent campaigns (left) · team and details (right) ── */}
            <div className="grid grid-cols-12 gap-4">
                <section className="col-span-12 animate-fade-up overflow-hidden rounded-3xl border border-foreground/[0.08] bg-card shadow-card [animation-delay:240ms] lg:col-span-7">
                    <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-5">
                        <div>
                            <h3 className="font-display text-base font-semibold tracking-tight">Recent campaigns</h3>
                            <p className="text-xs text-muted-foreground">The latest work under this brand.</p>
                        </div>
                        <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
                            {brand.recentCampaigns.length}
                        </span>
                    </div>
                    {brand.recentCampaigns.length === 0 ? (
                        <div className="mx-6 mb-6 grid place-items-center gap-2 rounded-2xl border-2 border-dashed border-foreground/10 px-6 py-10 text-center">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"><Megaphone className="h-4 w-4 text-muted-foreground" /></span>
                            <p className="text-sm font-semibold">No campaigns yet</p>
                            <p className="text-xs text-muted-foreground">Campaigns created for this brand will show up here.</p>
                        </div>
                    ) : (
                        <ul className="px-3 pb-3">
                            {brand.recentCampaigns.map((campaign, i) => (
                                <li
                                    key={campaign.id}
                                    className={cn('flex animate-fade-up items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-secondary/60', ROW_DELAYS[Math.min(i, ROW_DELAYS.length - 1)])}
                                >
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 font-display text-sm font-bold">
                                        {campaign.name.charAt(0).toUpperCase()}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">{campaign.name}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Created {new Date(campaign.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </p>
                                    </div>
                                    <p className="hidden font-display text-sm font-semibold tabular-nums sm:block">₹{formatCompactCurrency(campaign.budgetTotal)}</p>
                                    <StatusBadge status={campaign.status as ComponentProps<typeof StatusBadge>['status']} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <div className="col-span-12 flex flex-col gap-4 lg:col-span-5">
                    {/* One Team section — team members granted access to this brand. Owner-only:
                        a team member viewing a brand assigned to them doesn't manage the team. */}
                    {isOwned && (
                        <section className="animate-fade-up overflow-hidden rounded-3xl border border-foreground/[0.08] bg-card shadow-card [animation-delay:300ms]">
                            <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-5">
                                <div>
                                    <h3 className="font-display text-base font-semibold tracking-tight">Team</h3>
                                    <p className="text-xs text-muted-foreground">
                                        {teamCount} {teamCount === 1 ? 'person' : 'people'} with access to this brand
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddTeam}
                                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold shadow-sm transition-colors hover:border-transparent hover:bg-brand"
                                >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Add
                                </button>
                            </div>
                            {teamCount === 0 ? (
                                <div className="mx-6 mb-6 grid place-items-center gap-2 rounded-2xl border-2 border-dashed border-foreground/10 px-6 py-8 text-center">
                                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"><UserPlus className="h-4 w-4 text-muted-foreground" /></span>
                                    <p className="text-sm font-semibold">No team members yet</p>
                                    <p className="text-xs text-muted-foreground">You manage this brand directly.</p>
                                </div>
                            ) : (
                                <div className="px-3 pb-3">
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

                    <section className="animate-fade-up rounded-3xl border border-foreground/[0.08] bg-card p-6 shadow-card [animation-delay:360ms]">
                        <h3 className="font-display text-base font-semibold tracking-tight">Brand details</h3>
                        <dl className="mt-4 space-y-3">
                            {details.map((item) => (
                                <div key={item.label} className="flex items-center gap-3">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary"><item.icon className="h-3.5 w-3.5 text-muted-foreground" /></span>
                                    <div className="min-w-0">
                                        <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{item.label}</dt>
                                        <dd className="truncate text-[13px] font-medium">
                                            {item.href ? (
                                                <a href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="underline-offset-4 hover:underline">
                                                    {item.value}
                                                </a>
                                            ) : item.value}
                                        </dd>
                                    </div>
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
