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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { ApiImage } from '@/shared/components/ApiImage';
import { StatCard } from '@/shared/components/StatCard';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { CampaignStatusBadge } from '@/modules/campaigns/components/CampaignStatusBadge';
import { EmptyState } from '@/shared/components/EmptyState';
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

    return (
        <div className="w-full animate-fade-in">
            <button onClick={() => navigate('/teams')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-premium mb-6">
                <ChevronLeft className="w-4 h-4" /> Back to Teams
            </button>

            {/* Profile header */}
            <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl font-bold font-display truncate">{member.name}</h1>
                        <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            member.isActive ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground',
                        )}>
                            {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                    {member.phoneNumber && (
                        <p className="text-sm text-muted-foreground truncate">{member.phoneNumber}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">Joined {new Date(member.createdAt).toLocaleDateString()}</p>
                    {isAgencyOwner && member.brands.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {member.brands.map((b) => (
                                <span key={b.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-secondary text-foreground border border-border">
                                    {b.brandName}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isSettingStatus}
                        onClick={() => setStatus({ managerId: member.id, isActive: !member.isActive })}
                        className={cn(!member.isActive && 'text-green-600')}
                    >
                        {isSettingStatus ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : member.isActive ? (
                            <UserX className="w-3.5 h-3.5 mr-1.5" />
                        ) : (
                            <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {member.isActive ? 'Deactivate' : 'Reactivate'}
                    </Button>
                </div>
            </div>

            {/* Workload stats */}
            <div className={cn('mb-6 grid grid-cols-2 gap-3 sm:gap-4', isAgencyOwner ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
                <StatCard size="compact" tint="brand" icon={Megaphone} label="Assigned Campaigns" value={stats?.assignedCampaigns ?? 0} />
                <StatCard size="compact" tint="emerald" icon={Activity} label="Active Campaigns" value={stats?.activeCampaigns ?? 0} />
                <StatCard size="compact" tint="violet" icon={Rocket} label="Programs" value={stats?.assignedPrograms ?? 0} />
                {isAgencyOwner && (
                    <StatCard size="compact" tint="blue" icon={Building2} label="Brands Managed" value={stats?.brandsManaged ?? 0} />
                )}
            </div>

            {/* Assigned campaigns */}
            <WorkSection
                title="Assigned campaigns"
                subtitle="Campaigns this member is responsible for running."
                loading={workloadLoading}
                emptyIcon={Megaphone}
                emptyTitle="No campaigns assigned"
                emptyText="Assign a campaign from the member's brands so they can start managing it."
                actionLabel={canAssign ? 'Assign a campaign' : undefined}
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

            {/* Assigned programs */}
            <WorkSection
                title="Assigned programs"
                subtitle="Programs this member is responsible for running."
                loading={workloadLoading}
                emptyIcon={Rocket}
                emptyTitle="No programs assigned"
                emptyText="Assign a program from the member's brands so they can start managing it."
                actionLabel={canAssign ? 'Assign a program' : undefined}
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
    title,
    subtitle,
    loading,
    emptyIcon,
    emptyTitle,
    emptyText,
    actionLabel,
    onAction,
    children,
}: {
    title: string;
    subtitle: string;
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
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-base font-semibold font-display">{title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
                {actionLabel && (
                    <Button size="sm" variant="outline" onClick={onAction} className="shrink-0">
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> {actionLabel}
                    </Button>
                )}
            </div>
            {loading ? (
                <div className="p-5 space-y-2">
                    {[1, 2].map((i) => <div key={i} className="h-14 bg-secondary/60 rounded-lg animate-pulse" />)}
                </div>
            ) : hasItems ? (
                <div className="divide-y divide-border">{children}</div>
            ) : (
                <EmptyState icon={emptyIcon as never} title={emptyTitle} description={emptyText} action={actionLabel ? { label: actionLabel, onClick: onAction } : undefined} />
            )}
        </div>
    );
}

// ── Rows ─────────────────────────────────────────────────────────────────────
function CampaignRow({ campaign, onChangeOwner }: { campaign: TeamWorkloadCampaign; onChangeOwner: () => void }) {
    return (
        <div className="flex items-center gap-3 px-5 py-3">
            <div className="w-11 h-11 rounded-lg bg-secondary overflow-hidden shrink-0">
                {campaign.thumbnailUrl && <ApiImage src={campaign.thumbnailUrl} alt={campaign.name} className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
                <Link to={`/campaigns/${campaign.id}`} className="text-sm font-medium truncate hover:underline block">{campaign.name}</Link>
                <div className="flex items-center gap-2 mt-0.5">
                    {campaign.brandName && <span className="text-xs text-muted-foreground truncate">{campaign.brandName}</span>}
                    <CampaignStatusBadge campaign={campaign} className="scale-90 origin-left" />
                </div>
            </div>
            <Button size="sm" variant="ghost" onClick={onChangeOwner} className="shrink-0">
                <UserCog className="w-3.5 h-3.5 mr-1.5" /> Change team member
            </Button>
        </div>
    );
}

function ProgramRow({ program, onChangeOwner }: { program: TeamWorkloadProgram; onChangeOwner: () => void }) {
    return (
        <div className="flex items-center gap-3 px-5 py-3">
            <div className="w-11 h-11 rounded-lg bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                {program.thumbnailUrl ? <ApiImage src={program.thumbnailUrl} alt={program.name} className="w-full h-full object-cover" /> : <Rocket className="w-5 h-5 text-muted-foreground/50" />}
            </div>
            <div className="min-w-0 flex-1">
                <Link to={`/programs/${program.id}`} className="text-sm font-medium truncate hover:underline block">{program.name}</Link>
                <div className="flex items-center gap-2 mt-0.5">
                    {program.brandName && <span className="text-xs text-muted-foreground truncate">{program.brandName}</span>}
                    <StatusBadge status={program.status as never} className="scale-90 origin-left" />
                </div>
            </div>
            <Button size="sm" variant="ghost" onClick={onChangeOwner} className="shrink-0">
                <UserCog className="w-3.5 h-3.5 mr-1.5" /> Change team member
            </Button>
        </div>
    );
}
