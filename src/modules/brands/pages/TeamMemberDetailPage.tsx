import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    ChevronLeft,
    Megaphone,
    Rocket,
    Building2,
    Activity,
    Pencil,
    UserX,
    UserCheck,
    Loader2,
    Plus,
    UserCog,
    Users,
    Mail,
    Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiImage } from '@/shared/components/ApiImage';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { CampaignStatusBadge } from '@/modules/campaigns/components/CampaignStatusBadge';
import { AssignAgentModal } from '@/shared/components/AssignAgentModal';
import { queryKeys } from '@/core/queryKeys';
import { useIsAgencyOwner } from '@/shared/hooks/useIsAgencyOwner';
import { useBrandProfiles } from '@/shared/hooks/useBrandProfiles';
import { useAssignCampaignAgent } from '@/modules/campaigns/hooks/useCampaigns';
import { useAssignProgramAgent } from '@/modules/programs/hooks/usePrograms';
import {
    useTeamMember,
    useTeamMemberWorkload,
    useSetTeamMemberStatus,
    type TeamMemberWorkload,
    type TeamWorkloadCampaign,
    type TeamWorkloadProgram,
} from '../hooks/useTeam';
import { EditTeamMemberModal } from '../components/EditTeamMemberModal';
import { AssignWorkToMemberModal, type AssignableWorkItem } from '../components/AssignWorkToMemberModal';
import { memberInitials } from '../components/TeamMemberCard';

export default function TeamMemberDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isBrandOwner, isAgencyOwner } = useIsAgencyOwner();

    const { data: member, isLoading: memberLoading, isError } = useTeamMember(id);
    const { data: workload, isLoading: workloadLoading } = useTeamMemberWorkload(id);
    const { data: ownedBrands = [] } = useBrandProfiles(isAgencyOwner);
    const assignableBrands = ownedBrands.filter((b) => b.relation === 'owned');

    const { mutate: setStatus, isPending: isSettingStatus } = useSetTeamMemberStatus();
    const { mutateAsync: assignCampaign } = useAssignCampaignAgent();
    const { mutateAsync: assignProgram } = useAssignProgramAgent();

    const [editOpen, setEditOpen] = useState(false);
    // Single-item owner change (reuses the shared team-member picker).
    // brandId is carried so the picker can offer only members who manage that brand —
    // this member's work can span several brands, so it isn't a single page-level value.
    const [ownerChange, setOwnerChange] = useState<{ kind: 'campaign' | 'program'; id: string; name: string; agentId: string | null; brandId: string } | null>(null);
    // Bulk "assign a campaign/program to this member" picker.
    const [assignPicker, setAssignPicker] = useState<null | 'campaign' | 'program'>(null);

    const invalidateWorkload = () => {
        if (id) queryClient.invalidateQueries({ queryKey: queryKeys.team.workload(id) });
    };

    // Reflect an (re)assignment in the cached workload immediately so the assigned/assignable
    // lists and stat tiles update the instant the request lands — the background refetch then
    // reconciles (e.g. fills in the real agentName when ownership moves to someone else).
    const applyAgentOptimistic = (kind: 'campaign' | 'program', itemId: string, agentId: string | null, agentName: string | null) => {
        if (!id || !member) return;
        const myId = member.id;
        queryClient.setQueryData<TeamMemberWorkload>(queryKeys.team.workload(id), (old) => {
            if (!old) return old;
            const patch = <T extends { id: string; agentId: string | null; agentName: string | null }>(list: T[]) =>
                list.map((it) => (it.id === itemId ? { ...it, agentId, agentName } : it));
            const campaigns = kind === 'campaign' ? patch(old.campaigns) : old.campaigns;
            const programs = kind === 'program' ? patch(old.programs) : old.programs;
            const mine = campaigns.filter((c) => c.agentId === myId);
            const minePrograms = programs.filter((p) => p.agentId === myId);
            return {
                ...old,
                campaigns,
                programs,
                stats: {
                    ...old.stats,
                    assignedCampaigns: mine.length,
                    activeCampaigns: mine.filter((c) => c.status === 'active').length,
                    assignedPrograms: minePrograms.length,
                },
            };
        });
    };

    if (!isBrandOwner) {
        return (
            <div className="w-full animate-fade-in">
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                    <Users className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-semibold mb-1">Not available for your account</p>
                    <p className="text-sm text-muted-foreground">Team management is available to brand owners.</p>
                </div>
            </div>
        );
    }

    if (memberLoading) {
        return (
            <div className="w-full animate-fade-in">
                <div className="h-9 w-40 bg-secondary/60 rounded-lg animate-pulse mb-6" />
                <div className="h-[120px] bg-secondary/60 rounded-2xl animate-pulse mb-6" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-secondary/60 rounded-2xl animate-pulse" />)}
                </div>
            </div>
        );
    }

    if (isError || !member) {
        return (
            <div className="w-full animate-fade-in">
                <button onClick={() => navigate('/teams')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-premium mb-6">
                    <ChevronLeft className="w-4 h-4" /> Back to Teams
                </button>
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                    <p className="text-sm font-semibold mb-1">Team member not found</p>
                    <p className="text-sm text-muted-foreground">They may have been removed, or you don't have access.</p>
                </div>
            </div>
        );
    }

    const stats = workload?.stats;
    const campaigns = workload?.campaigns ?? [];
    const programs = workload?.programs ?? [];
    const assignedCampaigns = campaigns.filter((c) => c.agentId === member.id);
    const assignedPrograms = programs.filter((p) => p.agentId === member.id);
    const assignableCampaigns: AssignableWorkItem[] = campaigns.filter((c) => c.agentId !== member.id);
    const assignablePrograms: AssignableWorkItem[] = programs.filter((p) => p.agentId !== member.id);
    // The assign action is offered whenever the member manages at least one brand — the
    // picker itself reports when there's nothing (yet) to assign. Gating on the assignable
    // count instead would hide the button entirely for a section with no items, which is
    // exactly the campaigns/programs inconsistency we're fixing.
    const canAssign = (stats?.brandsManaged ?? 0) > 0;

    const handleChangeOwner = async (agentId: string | null) => {
        if (!ownerChange) return;
        const { kind, id: itemId } = ownerChange;
        if (kind === 'campaign') await assignCampaign({ id: itemId, agentId });
        else await assignProgram({ id: itemId, agentId });
        // agentName is unknown here (the picker returns only an id) — the refetch fills it in.
        applyAgentOptimistic(kind, itemId, agentId, agentId === member.id ? member.name : null);
        toast.success(agentId ? 'Owner changed' : 'Handed back to the brand owner');
        invalidateWorkload();
    };

    const joined = new Date(member.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const figures = [
        { label: 'Campaigns', value: stats?.assignedCampaigns ?? 0, icon: Megaphone },
        { label: 'Live now', value: stats?.activeCampaigns ?? 0, icon: Activity, live: (stats?.activeCampaigns ?? 0) > 0 },
        { label: 'Programs', value: stats?.assignedPrograms ?? 0, icon: Rocket },
        ...(isAgencyOwner ? [{ label: 'Brands', value: stats?.brandsManaged ?? 0, icon: Building2 }] : []),
    ];

    return (
        <div className="w-full animate-fade-in pb-10">
            {/* ── Hero: a staff ID badge on the left (hangs from a clip, straightens on hover);
                contact, actions and the member's workload as big airy figures on the right. ── */}
            <section className="mb-5 grid animate-fade-up grid-cols-1 items-center gap-6 rounded-[28px] border border-border bg-card p-4 shadow-card sm:p-5 lg:grid-cols-[230px_minmax(0,1fr)]">
                {/* Member card in brand yellow, black and white only: status, the member, and two facts. */}
                <div className="flex items-center justify-center">
                    <div className="group/pass relative w-full max-w-[230px] rounded-[22px] bg-brand p-4 text-black shadow-[0_20px_40px_-18px_rgb(250_203_3_/_0.9)] transition-transform duration-500 ease-out hover:-translate-y-1">
                        <div className="flex justify-end">
                            <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold">
                                <span className="relative flex h-1.5 w-1.5">
                                    {member.isActive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-60" />}
                                    <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', member.isActive ? 'bg-black' : 'bg-black/30')} />
                                </span>
                                {member.isActive ? 'Active' : 'Paused'}
                            </span>
                        </div>

                        <span className={cn(
                            'mx-auto -mt-1 grid h-16 w-16 place-items-center rounded-full bg-white font-display text-xl font-bold shadow-sm transition-transform duration-300 group-hover/pass:scale-105',
                            !member.isActive && 'opacity-60 grayscale',
                        )}>
                            {memberInitials(member.name)}
                        </span>
                        <p className="mt-3 truncate text-center font-display text-lg font-semibold tracking-tight">{member.name}</p>
                        <p className="text-center text-[11px] font-medium text-black/60">Team member</p>

                        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-black/15 pt-3">
                            <div className="min-w-0">
                                <dt className="text-[10px] font-medium text-black/55">Brand</dt>
                                <dd className="truncate text-xs font-semibold" title={member.brands.map((b) => b.brandName).join(', ')}>
                                    {member.brands.length === 0 ? 'No brands' : member.brands.length === 1 ? member.brands[0].brandName : `${member.brands[0].brandName} +${member.brands.length - 1}`}
                                </dd>
                            </div>
                            <div className="min-w-0 text-right">
                                <dt className="text-[10px] font-medium text-black/55">Joined</dt>
                                <dd className="truncate text-xs font-semibold">{new Date(member.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col">
                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/teams')}
                            className="group/back flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ChevronLeft className="h-4 w-4 transition-transform group-hover/back:-translate-x-0.5" />
                            All team members
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setEditOpen(true)}
                                className="group/edit flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold transition-colors hover:border-foreground"
                            >
                                <Pencil className="h-3.5 w-3.5 transition-transform duration-300 group-hover/edit:-rotate-12" />
                                Edit
                            </button>
                            <button
                                type="button"
                                disabled={isSettingStatus}
                                onClick={() => setStatus({ managerId: member.id, isActive: !member.isActive })}
                                className={cn(
                                    'flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold transition-colors disabled:opacity-60',
                                    member.isActive ? 'text-muted-foreground hover:border-[#E50914] hover:text-[#E50914]' : 'text-emerald-700 hover:border-emerald-500',
                                )}
                            >
                                {isSettingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : member.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                                {member.isActive ? 'Deactivate' : 'Reactivate'}
                            </button>
                        </div>
                    </div>

                    <h2 className="mt-3 font-display text-xl font-semibold tracking-tight">{member.name.split(' ')[0]}'s workspace</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <a href={`mailto:${member.email}`} className="flex min-w-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-medium transition-colors hover:border-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{member.email}</span>
                        </a>
                        <span className={cn('flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-medium', !member.phoneNumber && 'border-dashed text-muted-foreground')}>
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {member.phoneNumber || 'No phone added'}
                        </span>
                    </div>

                    {/* Workload: one divided strip; zeros sit back in grey */}
                    <dl className={cn('mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-border', isAgencyOwner ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
                        {figures.map((figure, i) => (
                            <div key={figure.label} className={cn('px-4 py-3 transition-colors hover:bg-brand/[0.05]', i > 0 && 'border-l border-border', i === 2 && 'max-sm:border-l-0 max-sm:border-t', i === 3 && 'max-sm:border-t')}>
                                <dd className={cn('font-display text-2xl font-semibold leading-none tracking-tight tabular-nums', !workloadLoading && figure.value === 0 && 'text-muted-foreground/40')}>{workloadLoading ? '—' : figure.value}</dd>
                                <dt className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    {'live' in figure && figure.live ? (
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                                        </span>
                                    ) : <figure.icon className="h-3.5 w-3.5" />}
                                    {figure.label}
                                </dt>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            {/* ── The work: campaigns and programs side by side ── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <WorkSection
                    icon={Megaphone}
                    title="Assigned campaigns"
                    count={assignedCampaigns.length}
                    loading={workloadLoading}
                    emptyIcon={Megaphone}
                    emptyTitle="No campaigns assigned"
                    emptyText="Assign a campaign from the member's brands so they can start managing it."
                    actionLabel={canAssign ? 'Assign campaign' : undefined}
                    onAction={() => setAssignPicker('campaign')}
                >
                    {assignedCampaigns.map((c) => (
                        <CampaignRow
                            key={c.id}
                            campaign={c}
                            onChangeOwner={() => setOwnerChange({ kind: 'campaign', id: c.id, name: c.name, agentId: c.agentId, brandId: c.brandId })}
                        />
                    ))}
                </WorkSection>

                <WorkSection
                    icon={Rocket}
                    title="Assigned programs"
                    count={assignedPrograms.length}
                    loading={workloadLoading}
                    emptyIcon={Rocket}
                    emptyTitle="No programs assigned"
                    emptyText="Assign a program from the member's brands so they can start managing it."
                    actionLabel={canAssign ? 'Assign program' : undefined}
                    onAction={() => setAssignPicker('program')}
                >
                    {assignedPrograms.map((p) => (
                        <ProgramRow
                            key={p.id}
                            program={p}
                            onChangeOwner={() => setOwnerChange({ kind: 'program', id: p.id, name: p.name, agentId: p.agentId, brandId: p.brandId })}
                        />
                    ))}
                </WorkSection>
            </div>

            {/* Edit member */}
            <EditTeamMemberModal
                open={editOpen}
                onOpenChange={setEditOpen}
                member={member}
                isAgencyOwner={isAgencyOwner}
                assignableBrands={assignableBrands}
            />

            {/* Single-item owner change */}
            <AssignAgentModal
                isOpen={ownerChange !== null}
                onClose={() => setOwnerChange(null)}
                currentAgentId={ownerChange?.agentId ?? null}
                brandId={ownerChange?.brandId}
                // This page reassigns work off THIS member, so they are never a valid
                // target — listing them just offers the state the user is trying to change.
                excludeAgentId={member.id}
                itemName={ownerChange?.name ?? ''}
                onAssign={handleChangeOwner}
            />

            {/* Bulk assign picker */}
            {assignPicker === 'campaign' && (
                <AssignWorkToMemberModal
                    open
                    onOpenChange={(next) => { if (!next) setAssignPicker(null); }}
                    memberName={member.name}
                    kind="campaign"
                    items={assignableCampaigns}
                    onAssign={async (itemId) => {
                        await assignCampaign({ id: itemId, agentId: member.id });
                        applyAgentOptimistic('campaign', itemId, member.id, member.name);
                        toast.success(`Campaign assigned to ${member.name}`);
                        invalidateWorkload();
                    }}
                />
            )}
            {assignPicker === 'program' && (
                <AssignWorkToMemberModal
                    open
                    onOpenChange={(next) => { if (!next) setAssignPicker(null); }}
                    memberName={member.name}
                    kind="program"
                    items={assignablePrograms}
                    onAssign={async (itemId) => {
                        await assignProgram({ id: itemId, agentId: member.id });
                        applyAgentOptimistic('program', itemId, member.id, member.name);
                        toast.success(`Program assigned to ${member.name}`);
                        invalidateWorkload();
                    }}
                />
            )}
        </div>
    );
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function WorkSection({
    icon: Icon,
    title,
    count,
    loading,
    emptyTitle,
    emptyText,
    actionLabel,
    onAction,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    count: number;
    loading: boolean;
    emptyIcon: React.ComponentType<{ className?: string }>;
    emptyTitle: string;
    emptyText: string;
    actionLabel?: string;
    onAction: () => void;
    children: React.ReactNode[];
}) {
    const hasItems = children.length > 0;
    return (
        <section className="flex animate-fade-up flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-card [animation-delay:150ms]">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 ring-1 ring-brand/40"><Icon className="h-4 w-4" /></span>
                    <h3 className="flex min-w-0 items-center gap-2 font-display text-base font-semibold tracking-tight">
                        <span className="truncate">{title}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 font-sans text-[11px] font-semibold tabular-nums text-muted-foreground">{count}</span>
                    </h3>
                </div>
                {actionLabel && (
                    <button
                        type="button"
                        onClick={onAction}
                        className="group/add flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card pl-1 pr-3.5 text-xs font-semibold transition-colors hover:border-foreground"
                    >
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-black transition-transform duration-300 group-hover/add:rotate-90">
                            <Plus className="h-3.5 w-3.5" />
                        </span>
                        {actionLabel}
                    </button>
                )}
            </div>
            {loading ? (
                <div className="space-y-2 border-t border-border p-5">
                    {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-secondary/60" />)}
                </div>
            ) : hasItems ? (
                <ul className="border-t border-border">{children}</ul>
            ) : (
                // Ghost list: faint placeholder rows show what will appear here, with a short note.
                <div className="relative border-t border-border px-5 py-4">
                    <ul aria-hidden className="space-y-2.5 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]">
                        {[0, 1, 2].map((i) => (
                            <li key={i} className="flex items-center gap-3">
                                <span className="h-9 w-9 shrink-0 rounded-xl bg-secondary" />
                                <span className="flex-1 space-y-1.5">
                                    <span className={cn('block h-2.5 rounded-full bg-secondary', ['w-2/3', 'w-1/2', 'w-3/5'][i])} />
                                    <span className="block h-2 w-1/4 rounded-full bg-secondary/70" />
                                </span>
                                <span className="h-5 w-12 rounded-full bg-secondary/70" />
                            </li>
                        ))}
                    </ul>
                    <div className="absolute inset-0 grid place-items-center px-6 text-center">
                        <div>
                            <p className="text-sm font-semibold">{emptyTitle}</p>
                            <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{emptyText}</p>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

// ── Rows ─────────────────────────────────────────────────────────────────────
// Same anatomy as the brand page's campaign rows: a yellow marker and tile on hover, the
// change-owner action as a quiet round button that fills on hover.
function WorkRow({ href, name, sub, status, thumb, fallback: Fallback, onChangeOwner }: {
    href: string;
    name: string;
    sub?: string | null;
    status: React.ReactNode;
    thumb?: string | null;
    fallback: React.ComponentType<{ className?: string }>;
    onChangeOwner: () => void;
}) {
    return (
        <li className="group/row relative flex items-center gap-3.5 border-b border-border px-6 py-3.5 transition-colors last:border-0 hover:bg-brand/[0.05]">
            <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] scale-y-0 rounded-r-full bg-brand transition-transform duration-300 group-hover/row:scale-y-100" />
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary transition-colors group-hover/row:bg-brand">
                {thumb ? <ApiImage src={thumb} alt={name} className="h-full w-full object-cover" /> : <Fallback className="h-4 w-4 text-foreground/60" />}
            </div>
            <div className="min-w-0 flex-1">
                <Link to={href} className="block truncate text-sm font-semibold underline-offset-4 hover:underline">{name}</Link>
                <div className="mt-0.5 flex items-center gap-2">
                    {sub && <span className="truncate text-[11px] text-muted-foreground">{sub}</span>}
                    {status}
                </div>
            </div>
            <button
                type="button"
                onClick={onChangeOwner}
                title="Change team member"
                aria-label={`Change team member for ${name}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-brand"
            >
                <UserCog className="h-3.5 w-3.5" />
            </button>
        </li>
    );
}

function CampaignRow({ campaign, onChangeOwner }: { campaign: TeamWorkloadCampaign; onChangeOwner: () => void }) {
    return (
        <WorkRow
            href={`/campaigns/${campaign.id}`}
            name={campaign.name}
            sub={campaign.brandName}
            status={<CampaignStatusBadge campaign={campaign} className="scale-90 origin-left" />}
            thumb={campaign.thumbnailUrl}
            fallback={Megaphone}
            onChangeOwner={onChangeOwner}
        />
    );
}

function ProgramRow({ program, onChangeOwner }: { program: TeamWorkloadProgram; onChangeOwner: () => void }) {
    return (
        <WorkRow
            href={`/programs/${program.id}`}
            name={program.name}
            sub={program.brandName}
            status={<StatusBadge status={program.status as never} className="scale-90 origin-left" />}
            thumb={program.thumbnailUrl}
            fallback={Rocket}
            onChangeOwner={onChangeOwner}
        />
    );
}
