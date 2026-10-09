import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, UserX, Building2, Plus, Sparkles, LockKeyhole, UserPlus, Search, X } from 'lucide-react';
import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { HireManagerButton } from '@/shared/components/HireManagerButton';
import { fieldClass } from '@/shared/components/BentoUi';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTeamMembers } from '../hooks/useTeam';
import { CreateTeamMemberModal } from '../components/CreateTeamMemberModal';
import { TeamsExplainer } from '../components/TeamsExplainer';
import { TeamMemberCard, memberInitials } from '../components/TeamMemberCard';
import { useCurrentSubscription } from '@/modules/subscription/hooks/useSubscription';
import { useIsAgencyOwner } from '@/shared/hooks/useIsAgencyOwner';
import { useBrandProfiles } from '@/shared/hooks/useBrandProfiles';

type StatusFilter = 'all' | 'active' | 'inactive';

// Staggered entrance for roster cards; Tailwind needs the full class names spelled out.
const CARD_DELAYS = ['[animation-delay:0ms]', '[animation-delay:60ms]', '[animation-delay:120ms]', '[animation-delay:180ms]', '[animation-delay:240ms]', '[animation-delay:300ms]', '[animation-delay:360ms]', '[animation-delay:420ms]'];
const cardDelay = (i: number) => CARD_DELAYS[Math.min(i, CARD_DELAYS.length - 1)];

// Circumference of the hero's active-share ring (r = 23).
const RING_LENGTH = 2 * Math.PI * 23;

const primaryButton = 'flood-btn group flex h-10 items-center gap-2 rounded-xl border border-foreground bg-foreground px-3 text-[13px] font-semibold text-background shadow-sm duration-300 ease-out hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.97] sm:pl-2.5 sm:pr-4';
const secondaryButton = 'h-10 gap-2 rounded-xl border-border bg-card px-3 text-[13px] font-semibold text-foreground shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground hover:bg-card hover:text-foreground hover:shadow-float active:translate-y-0 active:scale-[0.97] sm:px-4';

export default function TeamsPage() {
    const navigate = useNavigate();
    const { isBrandOwner, isAgencyOwner } = useIsAgencyOwner();
    const activeBrandId = useAuthStore((s) => s.user?.brandId);
    const { data: teamMembers = [], isLoading } = useTeamMembers();
    const { data: subscription } = useCurrentSubscription(isBrandOwner);
    const isFreePlan = subscription?.plan === 'free';
    // Agency owners can optionally assign the new member to any of their owned brands; a
    // Brand-plan owner has a single brand, so the member is scoped to it automatically.
    const { data: ownedBrands = [] } = useBrandProfiles(isAgencyOwner);
    const assignableBrands = ownedBrands.filter((b) => b.relation === 'owned');

    const [createOpen, setCreateOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<StatusFilter>('all');

    const totalMembers = teamMembers.length;
    const activeMembers = teamMembers.filter((m) => m.isActive).length;
    const inactiveMembers = totalMembers - activeMembers;
    const activeShare = totalMembers ? Math.round((activeMembers / totalMembers) * 100) : 0;
    const brandsCovered = isAgencyOwner
        ? new Set(teamMembers.flatMap((m) => m.brands.map((b) => b.id))).size
        : 0;
    const newestMember = useMemo(
        () => [...teamMembers].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
        [teamMembers],
    );

    const visibleMembers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return teamMembers
            .filter((m) => status === 'all' || (status === 'active' ? m.isActive : !m.isActive))
            .filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
            // Active members first, then most recently added.
            .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt.localeCompare(a.createdAt));
    }, [teamMembers, query, status]);

    const openCreate = () => (isFreePlan ? navigate('/subscription') : setCreateOpen(true));

    if (!isBrandOwner) {
        return (
            <div className="w-full animate-fade-in">
                <PageHeader title="Teams" description="Manage the people who help run your campaigns." infoTooltip="Team management lets brand owners delegate campaign work to invited members." />
                <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-card">
                    <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
                        <Users className="h-5 w-5 text-muted-foreground" />
                    </span>
                    <p className="font-display text-base font-semibold">Not available for your account</p>
                    <p className="mt-1 text-sm text-muted-foreground">Team management is available to brand owners.</p>
                </div>
            </div>
        );
    }

    const filters: { id: StatusFilter; label: string; count: number }[] = [
        { id: 'all', label: 'All', count: totalMembers },
        { id: 'active', label: 'Active', count: activeMembers },
        { id: 'inactive', label: 'Inactive', count: inactiveMembers },
    ];

    return (
        <div className="w-full animate-fade-in pb-10">
            <PageHeader
                title="Teams"
                description="The people who run campaigns on your behalf — each with their own login, scoped to your brands."
                animated
                size="lg"
                hideHireManager
                infoTooltip="People you invite to help run campaigns under your brand, using their own login. See the card below for how teams work."
                actions={
                    <>
                        <HireManagerButton className={secondaryButton} />
                        <button type="button" onClick={openCreate} className={primaryButton}>
                            <span className="flood-btn-icon grid h-5 w-5 place-items-center rounded-md bg-brand text-foreground">
                                {isFreePlan ? (
                                    <Sparkles className="h-3 w-3" />
                                ) : (
                                    <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />
                                )}
                            </span>
                            <span className="flood-btn-label hidden sm:inline">{isFreePlan ? 'Upgrade to invite' : 'Invite member'}</span>
                        </button>
                    </>
                }
            />

            <TeamsExplainer />

            {isFreePlan && (
                <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-card accent-border-left">
                    <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-foreground" />
                    Adding team members is available on paid plans.
                    <button type="button" onClick={() => navigate('/subscription')} className="ml-auto font-semibold text-foreground underline-offset-4 hover:underline">
                        See plans
                    </button>
                </div>
            )}

            {/* Overview — a dark roster hero beside two compact tiles */}
            <div className="mb-6 grid grid-cols-12 gap-4">
                <section className="relative col-span-12 flex animate-fade-up flex-col justify-between gap-6 overflow-hidden rounded-3xl bg-brand p-6 text-foreground shadow-card lg:col-span-7">
                    <span aria-hidden className="stat-glow pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-background/30 blur-3xl" />
                    <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgb(0_0_0)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

                    <div className="relative flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/60">Your crew</p>
                            <p className="mt-2 font-display text-5xl font-semibold leading-none tracking-tight tabular-nums">
                                {isLoading ? '—' : totalMembers}
                            </p>
                            <p className="mt-2 text-sm text-foreground/65">
                                {totalMembers === 1 ? 'person' : 'people'} helping run your campaigns
                            </p>
                        </div>

                        <span className="relative grid h-14 w-14 shrink-0 place-items-center" title={`${activeShare}% active`}>
                            <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden>
                                <circle cx="28" cy="28" r="23" fill="none" strokeWidth="5" className="stroke-foreground/15" />
                                <circle
                                    cx="28" cy="28" r="23" fill="none" strokeWidth="5" strokeLinecap="round"
                                    strokeDasharray={RING_LENGTH}
                                    strokeDashoffset={RING_LENGTH * (1 - activeShare / 100)}
                                    className="stroke-foreground transition-[stroke-dashoffset] [transition-duration:1200ms] ease-out"
                                />
                            </svg>
                            <span className="relative text-[11px] font-bold tabular-nums">{activeShare}%</span>
                        </span>
                    </div>

                    <div className="relative flex flex-wrap items-center justify-between gap-4">
                        {/* Avatar stack of the roster */}
                        <div className="flex items-center">
                            {teamMembers.slice(0, 5).map((m, i) => (
                                <span
                                    key={m.id}
                                    title={m.name}
                                    className={cn(
                                        'grid h-9 w-9 place-items-center rounded-full border-2 border-brand font-display text-[11px] font-bold animate-pop',
                                        i % 2 === 0 ? 'bg-foreground text-brand' : 'bg-background text-foreground',
                                        i > 0 && '-ml-2.5',
                                        cardDelay(i + 2),
                                    )}
                                >
                                    {memberInitials(m.name)}
                                </span>
                            ))}
                            {totalMembers > 5 && (
                                <span className="-ml-2.5 grid h-9 w-9 place-items-center rounded-full border-2 border-brand bg-foreground/10 text-[11px] font-semibold">
                                    +{totalMembers - 5}
                                </span>
                            )}
                            {!isLoading && totalMembers === 0 && (
                                <span className="text-sm text-foreground/60">No one here yet</span>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={openCreate}
                            className="flex h-8 items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/[0.06] px-3 text-xs font-semibold transition-colors hover:bg-foreground hover:text-brand"
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                            {isFreePlan ? 'Upgrade to invite' : 'Invite'}
                        </button>
                    </div>
                </section>

                <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-5">
                    <OverviewTile
                        icon={UserCheck}
                        label="Active"
                        value={activeMembers}
                        hint={newestMember ? `Newest: ${newestMember.name.split(' ')[0]}` : 'Can sign in today'}
                        dotClass="bg-success"
                        className="[animation-delay:80ms]"
                    />
                    <OverviewTile
                        icon={UserX}
                        label="Inactive"
                        value={inactiveMembers}
                        hint="Access paused, work kept"
                        dotClass="bg-muted-foreground/40"
                        className="[animation-delay:140ms]"
                    />
                    {isAgencyOwner && (
                        <OverviewTile
                            icon={Building2}
                            label="Brands covered"
                            value={brandsCovered}
                            hint={`of ${assignableBrands.length} owned brands`}
                            dotClass="bg-brand"
                            className="col-span-2 [animation-delay:200ms]"
                        />
                    )}
                </div>
            </div>

            {/* Toolbar — status segments and search */}
            {totalMembers > 0 && (
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex w-fit rounded-full border border-border bg-card p-1 shadow-card">
                        {filters.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setStatus(f.id)}
                                className={cn(
                                    'flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all duration-200',
                                    status === f.id ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {f.label}
                                <span className={cn(
                                    'rounded-full px-1.5 text-[10px] tabular-nums',
                                    status === f.id ? 'bg-brand text-foreground' : 'bg-secondary text-muted-foreground',
                                )}>
                                    {f.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Glass search pill (same as the Campaigns page): frosted fill with a bright top edge
                        and a sheen that sweeps across every few seconds. On focus a soft yellow aura glows
                        behind it, it widens a little and the icon tilts. */}
                    <div className="group/search relative w-full min-w-0 transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] sm:w-80 lg:focus-within:w-[380px]">
                        <span aria-hidden className="pointer-events-none absolute -inset-2 rounded-full bg-[radial-gradient(55%_120%_at_25%_50%,rgb(250_203_3_/_0.5),transparent_70%)] opacity-0 blur-lg transition-opacity duration-500 group-focus-within/search:opacity-100" />
                        <label className="relative flex h-11 items-center gap-2.5 overflow-hidden rounded-full border border-white/80 bg-gradient-to-b from-white/90 to-white/55 px-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.95),inset_0_-1px_0_rgb(0_0_0_/_0.04),0_1px_2px_rgb(0_0_0_/_0.04),0_10px_28px_-14px_rgb(0_0_0_/_0.22)] ring-1 ring-black/[0.06] backdrop-blur-xl transition-all duration-300 hover:ring-black/10 group-focus-within/search:from-white group-focus-within/search:to-white/80 group-focus-within/search:ring-black/15">
                            <span aria-hidden className="search-sheen pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/90 to-transparent" />
                            <Search className="relative h-4 w-4 shrink-0 text-muted-foreground transition-all duration-300 group-focus-within/search:-rotate-12 group-focus-within/search:scale-110 group-focus-within/search:text-foreground" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search name or email"
                                aria-label="Search team members by name or email"
                                className="relative h-full w-full bg-transparent text-sm placeholder:text-muted-foreground/75 focus:outline-none focus-visible:shadow-none"
                            />
                            {query && (
                                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="relative grid h-6 w-6 shrink-0 animate-pop place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-110">
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </label>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-[248px] animate-pulse rounded-3xl bg-secondary/60" />
                    ))}
                </div>
            ) : totalMembers === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card shadow-card">
                    <EmptyState
                        icon={Users}
                        title="No team members yet"
                        description="Add people to help manage campaigns, applications, and content on your behalf."
                        action={{ label: isFreePlan ? 'Upgrade to add' : 'Add team member', onClick: openCreate }}
                    />
                </div>
            ) : visibleMembers.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
                    <Search className="mx-auto mb-3 h-6 w-6 text-muted-foreground/50" />
                    <p className="font-display text-sm font-semibold">No members match</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try a different name, or clear the filters.</p>
                    <button
                        type="button"
                        onClick={() => { setQuery(''); setStatus('all'); }}
                        className="mt-4 h-8 rounded-full border border-border px-4 text-xs font-semibold transition-colors hover:border-foreground"
                    >
                        Clear filters
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {visibleMembers.map((member, i) => (
                        <TeamMemberCard
                            key={member.id}
                            member={member}
                            showBrands={isAgencyOwner}
                            onOpen={() => navigate(`/teams/${member.id}`)}
                            className={cardDelay(i)}
                        />
                    ))}

                    {/* Invite tile closes the grid so adding someone is always one click away */}
                    {status !== 'inactive' && !query && (
                        <button
                            type="button"
                            onClick={openCreate}
                            className={cn(
                                'group flex min-h-[248px] animate-fade-up flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border p-5 text-center transition-all duration-300 hover:border-foreground/40 hover:bg-card',
                                cardDelay(visibleMembers.length),
                            )}
                        >
                            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary transition-all duration-300 group-hover:bg-foreground group-hover:text-brand">
                                {isFreePlan ? <LockKeyhole className="h-5 w-5" /> : <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />}
                            </span>
                            <span>
                                <span className="block font-display text-sm font-semibold">{isFreePlan ? 'Unlock team seats' : 'Invite a teammate'}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {isFreePlan ? 'Available on paid plans' : 'They get their own login'}
                                </span>
                            </span>
                        </button>
                    )}
                </div>
            )}

            <CreateTeamMemberModal
                open={createOpen}
                onOpenChange={setCreateOpen}
                isAgencyOwner={isAgencyOwner}
                assignableBrands={assignableBrands}
                activeBrandId={activeBrandId}
            />
        </div>
    );
}

interface OverviewTileProps {
    icon: typeof Users;
    label: string;
    value: number;
    hint: string;
    dotClass: string;
    className?: string;
}

function OverviewTile({ icon: Icon, label, value, hint, dotClass, className }: OverviewTileProps) {
    return (
        <section className={cn(
            'flex animate-fade-up flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-float',
            className,
        )}>
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <span className={cn('h-2 w-2 rounded-full', dotClass)} />
                    {label}
                </span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-brand">
                    <Icon className="h-3.5 w-3.5" />
                </span>
            </div>
            <div className="mt-6">
                <p className="font-display text-[32px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
                <p className="mt-2 truncate text-[11px] font-medium text-muted-foreground">{hint}</p>
            </div>
        </section>
    );
}
