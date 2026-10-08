import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryKeys';
import {
    Loader2, ArrowLeft, Users, Send,
    ToggleLeft, ToggleRight, AlertCircle, ChevronDown,
    UserCheck, Megaphone, Square, CheckSquare, Plus, Inbox,
    Wallet, Trophy, ExternalLink, X, MapPin, BarChart3,
    Star, BadgeCheck, Languages, Globe,
} from 'lucide-react';
import { CampaignCard } from '@/modules/campaigns/components/CampaignCard';
import { ApiImage } from '@/shared/components/ApiImage';
import {
    useProgram,
    useEnrollments,
    useInviteFromEnrollment,
    useUpdateProgram,
    useProgramEnrollmentRealtime,
} from '../hooks/usePrograms';
import { useCampaigns } from '@/modules/campaigns/hooks/useCampaigns';
import { getCampaignDisplayStatus } from '@/modules/campaigns/utils/campaignStatus';
import type { ProgramEnrollment } from '@/shared/types/campaign';
import { useProfileGate } from '@/shared/hooks/useProfileGate';
import { cn } from '@/lib/utils';
import { useInfluencer } from '@/modules/discover/hooks/useInfluencers';
import { PLATFORM_ICONS } from '@/shared/components/SocialIcons';

// ─── Influencer Preview Modal ─────────────────────────────────────────────────

const formatFollowers = (n: number | undefined | null) => {
    if (n == null || n === 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString('en-IN');
};

function InfluencerPreviewModal({
    influencerId,
    onClose,
}: {
    influencerId: string;
    onClose: () => void;
}) {
    const navigate = useNavigate();
    const { data: influencer, isLoading } = useInfluencer(influencerId);

    const connectedPlatforms = ((influencer?.platforms || []) as any[]).filter(
        (p) => p.handle && p.handle.trim() !== ''
    );

    const engagementNumber = Number(influencer?.engagementRate);
    const engagementValue =
        influencer?.engagementRate != null &&
        influencer.engagementRate !== '' &&
        Number.isFinite(engagementNumber)
            ? `${engagementNumber.toFixed(2)}%`
            : null;

    const totalFollowers =
        influencer?.followerCount && influencer.followerCount > 0
            ? influencer.followerCount
            : connectedPlatforms.reduce((sum, p) => sum + (Number(p.followers) || 0), 0);

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-fade-in">
                {/* Header bar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30">
                    <p className="text-sm font-semibold text-muted-foreground">Creator Profile</p>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {isLoading || !influencer ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="overflow-y-auto" style={{ maxHeight: '75dvh' }}>
                        {/* Identity */}
                        <div className="p-5 space-y-4">
                            <div className="flex items-start gap-4">
                                {/* Avatar */}
                                <div className="w-16 h-16 rounded-2xl bg-foreground text-background flex items-center justify-center text-2xl font-semibold shrink-0 overflow-hidden ring-1 ring-black/5">
                                    {influencer.userAvatarUrl ? (
                                        <ApiImage src={influencer.userAvatarUrl} alt={influencer.userName} className="w-full h-full object-cover" fallbackText={influencer.userName?.charAt(0) || '?'} />
                                    ) : (
                                        <span>{influencer.userName?.charAt(0) || '?'}</span>
                                    )}
                                </div>

                                {/* Name + handle + meta */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h2 className="font-bold text-lg leading-tight truncate">{influencer.userName || 'Creator'}</h2>
                                        {influencer.isVerified && (
                                            <BadgeCheck className="w-4 h-4 text-[#0a0a0a] fill-[#fedc03] shrink-0" />
                                        )}
                                    </div>
                                    {influencer.handle && (
                                        <p className="text-sm text-muted-foreground mt-0.5">{influencer.handle}</p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                        {influencer.tier && (
                                            <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold capitalize text-background">
                                                {influencer.tier}
                                            </span>
                                        )}
                                        {influencer.location && (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                                <MapPin className="w-3 h-3" />{influencer.location}
                                            </span>
                                        )}
                                        {influencer.languages && influencer.languages.length > 0 && (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                                <Languages className="w-3 h-3" />{influencer.languages.join(', ')}
                                            </span>
                                        )}
                                        {influencer.rating != null && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                                                <Star className="w-3 h-3 fill-[#fedc03] text-[#fedc03]" />
                                                {influencer.rating}
                                                {influencer.ratingCount ? <span className="text-muted-foreground font-normal">({influencer.ratingCount})</span> : null}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Platform chips */}
                            {connectedPlatforms.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {connectedPlatforms.map((p: any) => {
                                        const Icon = PLATFORM_ICONS[p.platform?.toLowerCase()] || Globe;
                                        const followers = Number(p.followers || p.followerCount) || 0;
                                        return (
                                            <span key={p.platform} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                                {followers > 0 ? formatFollowers(followers) : p.platform}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Bio */}
                            {influencer.bio && (
                                <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">{influencer.bio}</p>
                            )}

                            {/* Niches */}
                            {influencer.niches && influencer.niches.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {influencer.niches.map((n) => (
                                        <span key={n} className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-foreground/70">{n}</span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Key stats */}
                        <div className="grid grid-cols-3 gap-px bg-border/60 border-t border-border">
                            {[
                                { icon: Users, label: 'Followers', value: formatFollowers(totalFollowers) },
                                { icon: BarChart3, label: 'Engagement', value: engagementValue || '—' },
                                { icon: Trophy, label: 'Campaigns', value: String(influencer.pastCollaborations || 0) },
                            ].map(({ icon: Icon, label, value }) => (
                                <div key={label} className="bg-card px-4 py-3.5 text-center">
                                    <p className="flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground mb-1">
                                        <Icon className="w-3 h-3" />{label}
                                    </p>
                                    <p className="text-base font-bold tabular-nums">{value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Footer actions */}
                        <div className="flex items-center gap-3 p-4 border-t border-border bg-secondary/20">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => { onClose(); navigate(`/discover/${influencerId}`); }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
                            >
                                View Full Profile
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

// ─── Invite to Campaign Modal ─────────────────────────────────────────────────

function InviteToCampaignModal({
    programId,
    enrollmentIds,
    alreadyInvitedCampaignIds = [],
    onClose,
}: {
    programId: string;
    enrollmentIds: string[];
    alreadyInvitedCampaignIds?: string[];
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [localPending, setLocalPending] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const { data: campaignsData } = useCampaigns({ limit: 100 });
    const { mutateAsync: invite } = useInviteFromEnrollment();

    const isBulk = enrollmentIds.length > 1;

    const availableCampaigns = (campaignsData?.data ?? []).filter(
        (c: any) =>
            c.programId === programId &&
            c.status !== 'draft' &&
            c.status !== 'withdrawn' &&
            !alreadyInvitedCampaignIds.includes(c.id)
    );

    const handleSubmit = async () => {
        if (!selectedCampaignId) return;
        setLocalPending(true);
        setErrorMsg(null);
        try {
            await Promise.all(
                enrollmentIds.map((enrollmentId) =>
                    invite({ programId, enrollmentId, campaignId: selectedCampaignId })
                )
            );
            queryClient.setQueryData<ProgramEnrollment[]>(
                queryKeys.programs.enrollments(programId),
                (old) =>
                    old?.map((e) =>
                        enrollmentIds.includes(e.id)
                            ? {
                                  ...e,
                                  hasBeenInvited: true,
                                  invitedCampaignIds: [
                                      ...new Set([...(e.invitedCampaignIds ?? []), selectedCampaignId]),
                                  ],
                              }
                            : e
                    ) ?? []
            );
            onClose();
        } catch (err: any) {
            setErrorMsg(err?.response?.data?.error?.message ?? 'Failed to send invite(s)');
        } finally {
            setLocalPending(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
                {/* Modal header strip */}
                <div className="px-6 pt-6 pb-4 border-b border-border bg-secondary/30">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#fedc03]/20 border border-[#fedc03]/30 flex items-center justify-center">
                            <Send className="w-4 h-4 text-[#0a0a0a]" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold">
                                {isBulk ? `Invite ${enrollmentIds.length} Creators` : 'Invite to Campaign'}
                            </h2>
                            <p className="text-xs text-muted-foreground">Select a campaign from this program</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {errorMsg && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-sm text-destructive">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            {errorMsg}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-1.5">Campaign</label>
                        {availableCampaigns.length === 0 ? (
                            <div className="p-3.5 rounded-xl bg-secondary/50 border border-border text-sm text-muted-foreground">
                                {alreadyInvitedCampaignIds.length > 0
                                    ? 'This creator has already been invited to all campaigns in this program.'
                                    : 'No active campaigns found in this program. Create one first.'}
                            </div>
                        ) : (
                            <div className="relative">
                                <select
                                    value={selectedCampaignId}
                                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                                    className="flex h-10 w-full rounded-xl border border-border bg-background pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fedc03]/40 focus:border-[#fedc03] appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>Choose a campaign…</option>
                                    {availableCampaigns.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground/60">
                                    <ChevronDown className="h-4 w-4" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!selectedCampaignId || localPending || availableCampaigns.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fedc03] text-[#1a1100] text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                        >
                            {localPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isBulk ? `Send ${enrollmentIds.length} Invites` : 'Send Invite'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Enrollments Panel ────────────────────────────────────────────────────────

function EnrollmentsPanel({
    programId,
    enrollmentOpen,
    onToggleEnrollment,
}: {
    programId: string;
    enrollmentOpen: boolean;
    onToggleEnrollment: () => void;
}) {
    const { data: enrollments = [], isLoading } = useEnrollments(programId);
    const { data: campaignsData } = useCampaigns({ limit: 100 });

    const [filterTab, setFilterTab] = useState<'enrolled' | 'invited'>('enrolled');
    const [inviteTarget, setInviteTarget] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
    // Inviting enrolled creators requires a complete brand profile incl. a linked social account.
    const { requireCompleteProfile } = useProfileGate();
    const navigate = useNavigate();
    const [previewInfluencerId, setPreviewInfluencerId] = useState<string | null>(null);

    const programCampaigns = (campaignsData?.data ?? []).filter(
        (c: any) => c.programId === programId && c.status !== 'draft' && c.status !== 'withdrawn'
    );
    const hasProgramCampaigns = programCampaigns.length > 0;

    const enrolledList = (enrollments as ProgramEnrollment[]).filter(
        (e) => e.status !== 'withdrawn'
    );
    const invitedList = (enrollments as ProgramEnrollment[]).filter(
        (e) => e.hasBeenInvited === true
    );

    const invitedByCampaign = programCampaigns
        .map((campaign: any) => ({
            campaign,
            enrollments: invitedList.filter((e) =>
                (e.invitedCampaignIds ?? []).includes(campaign.id)
            ),
        }))
        .filter((g) => g.enrollments.length > 0);

    const counts = { enrolled: enrolledList.length, invited: invitedList.length };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedIds(new Set(enrolledList.map((e) => e.id)));
    const clearSelection = () => setSelectedIds(new Set());

    return (
        <div className="space-y-4">
            {/* Enrollment toggle */}
            <div className={cn(
                'flex items-center justify-between p-4 rounded-xl border transition-colors',
                enrollmentOpen
                    ? 'border-emerald-500/25 bg-emerald-500/5'
                    : 'border-border bg-secondary/30'
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        enrollmentOpen ? 'bg-emerald-500/15' : 'bg-secondary'
                    )}>
                        <Users className={cn('w-4 h-4', enrollmentOpen ? 'text-emerald-600' : 'text-muted-foreground')} />
                    </div>
                    <div>
                        <p className="text-sm font-medium">Enrollment</p>
                        <p className="text-xs text-muted-foreground">
                            {enrollmentOpen
                                ? 'Open — influencers can discover and apply'
                                : 'Closed — influencers cannot apply'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onToggleEnrollment}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors',
                        enrollmentOpen
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15'
                            : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                    )}
                >
                    {enrollmentOpen
                        ? <><ToggleRight className="w-4 h-4" />Open</>
                        : <><ToggleLeft className="w-4 h-4" />Closed</>}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border/50 w-fit">
                    {(['enrolled', 'invited'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilterTab(tab)}
                            className={cn(
                                'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize flex items-center gap-1.5',
                                filterTab === tab
                                    ? 'bg-card shadow-sm text-foreground border border-border/60'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {tab === 'enrolled' ? <Users className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                            {tab}
                            {counts[tab] > 0 && (
                                <span className={cn(
                                    'px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center',
                                    tab === 'invited'
                                        ? 'bg-[#fedc03] text-[#1a1100]'
                                        : 'bg-secondary text-muted-foreground'
                                )}>
                                    {counts[tab]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {filterTab === 'enrolled' && enrolledList.length > 1 && selectedIds.size === 0 && (
                    <button
                        onClick={selectAll}
                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                        <CheckSquare className="w-3 h-3" />
                        Select all ({enrolledList.length})
                    </button>
                )}
            </div>

            {/* No campaigns warning */}
            {!hasProgramCampaigns && filterTab === 'enrolled' && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-medium text-amber-800">No campaigns yet</p>
                        <p className="text-xs text-amber-700 mt-0.5">Create a campaign linked to this program to enable inviting enrolled creators.</p>
                    </div>
                </div>
            )}

            {/* Content */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
            ) : filterTab === 'invited' ? (

                /* ── Invited tab: grouped by campaign ── */
                invitedList.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                            <Inbox className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No invites sent yet</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Invite creators from the Enrolled tab to get started.</p>
                    </div>
                ) : invitedByCampaign.length > 0 ? (
                    /* Primary: grouped by campaign */
                    <div className="space-y-3">
                        {invitedByCampaign.map(({ campaign, enrollments: group }, idx) => {
                            const accentColors = [
                                'border-l-violet-400',
                                'border-l-sky-400',
                                'border-l-emerald-400',
                                'border-l-rose-400',
                                'border-l-amber-400',
                            ];
                            const accent = accentColors[idx % accentColors.length];
                            return (
                                <div key={campaign.id} className={cn('rounded-xl border border-border bg-card overflow-hidden border-l-4', accent)}>
                                    {/* Campaign header */}
                                    <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30">
                                        <div className="w-9 h-9 rounded-lg overflow-hidden border border-border bg-secondary shrink-0 flex items-center justify-center">
                                            {campaign.thumbnailUrl
                                                ? <img src={campaign.thumbnailUrl} alt={campaign.name} className="w-full h-full object-cover" />
                                                : <Megaphone className="w-4 h-4 text-muted-foreground" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{campaign.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={cn(
                                                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full border capitalize',
                                                    campaign.status === 'active'    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                    campaign.status === 'completed' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                                    'bg-secondary text-muted-foreground border-border'
                                                )}>
                                                    {campaign.status}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#fedc03]/15 text-[#0a0a0a] border border-[#fedc03]/30">
                                            {group.length} creator{group.length !== 1 ? 's' : ''}
                                        </span>
                                        <Link
                                            to={`/campaigns/${campaign.id}`}
                                            className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            View
                                        </Link>
                                    </div>

                                    {/* Creator rows */}
                                    <div className="divide-y divide-border/40">
                                        {group.map((enrollment) => {
                                            const followers = typeof enrollment.followerCount === 'number' && enrollment.followerCount > 0
                                                ? enrollment.followerCount >= 1000
                                                    ? `${(enrollment.followerCount / 1000).toFixed(1)}K`
                                                    : String(enrollment.followerCount)
                                                : null;
                                            return (
                                                <div
                                                    key={enrollment.id}
                                                    onClick={() => setPreviewInfluencerId(enrollment.influencerId)}
                                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                                                >
                                                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden border border-border">
                                                        {enrollment.avatarUrl
                                                            ? <img src={enrollment.avatarUrl} alt={enrollment.name ?? ''} className="w-full h-full object-cover" />
                                                            : <span className="text-sm font-bold text-muted-foreground">{(enrollment.name ?? 'I')[0].toUpperCase()}</span>}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-sm font-semibold leading-tight">{enrollment.name ?? 'Influencer'}</span>
                                                            {enrollment.handle && <span className="text-xs text-muted-foreground">@{enrollment.handle}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            {enrollment.tier && (
                                                                <span className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground">
                                                                    {enrollment.tier}
                                                                </span>
                                                            )}
                                                            {followers && <span className="text-[11px] text-muted-foreground font-medium">{followers} followers</span>}
                                                            {enrollment.niches && enrollment.niches.length > 0 && (
                                                                <span className="text-[11px] text-muted-foreground truncate">{enrollment.niches.slice(0, 2).join(' · ')}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                                                        <UserCheck className="w-3.5 h-3.5" />
                                                        Invited
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Fallback: invitedCampaignIds not in API — flat list */
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="divide-y divide-border/40">
                            {invitedList.map((enrollment) => {
                                const followers = typeof enrollment.followerCount === 'number' && enrollment.followerCount > 0
                                    ? enrollment.followerCount >= 1000
                                        ? `${(enrollment.followerCount / 1000).toFixed(1)}K`
                                        : String(enrollment.followerCount)
                                    : null;
                                return (
                                    <div
                                        key={enrollment.id}
                                        onClick={() => setPreviewInfluencerId(enrollment.influencerId)}
                                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden border border-border">
                                            {enrollment.avatarUrl
                                                ? <img src={enrollment.avatarUrl} alt={enrollment.name ?? ''} className="w-full h-full object-cover" />
                                                : <span className="text-sm font-bold text-muted-foreground">{(enrollment.name ?? 'I')[0].toUpperCase()}</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-sm font-semibold leading-tight">{enrollment.name ?? 'Influencer'}</span>
                                                {enrollment.handle && <span className="text-xs text-muted-foreground">@{enrollment.handle}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                {enrollment.tier && (
                                                    <span className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full bg-secondary border border-border/60 text-muted-foreground">
                                                        {enrollment.tier}
                                                    </span>
                                                )}
                                                {followers && <span className="text-[11px] text-muted-foreground font-medium">{followers} followers</span>}
                                                {enrollment.niches && enrollment.niches.length > 0 && (
                                                    <span className="text-[11px] text-muted-foreground truncate">{enrollment.niches.slice(0, 2).join(' · ')}</span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                                            <UserCheck className="w-3.5 h-3.5" />
                                            Invited
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )

            ) : enrolledList.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                        {enrollmentOpen ? 'No creators enrolled yet' : 'Enrollment is closed'}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                        {enrollmentOpen
                            ? 'Influencers will appear here once they apply from the app.'
                            : 'Open enrollment above to let influencers apply.'}
                    </p>
                </div>
            ) : (

                /* ── Enrolled tab: flat list ── */
                <div className="space-y-2">
                    {enrolledList.map((enrollment: ProgramEnrollment) => {
                        const isSelected = selectedIds.has(enrollment.id);
                        const alreadyInvitedIds = enrollment.invitedCampaignIds ?? [];
                        const remainingCampaigns = programCampaigns.filter(
                            (c: any) => !alreadyInvitedIds.includes(c.id)
                        );
                        const canInvite = remainingCampaigns.length > 0;
                        const allInvited = hasProgramCampaigns && remainingCampaigns.length === 0;

                        return (
                            <div
                                key={enrollment.id}
                                onClick={() => setPreviewInfluencerId(enrollment.influencerId)}
                                className={cn(
                                    'flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer',
                                    isSelected
                                        ? 'border-[#fedc03]/50 bg-[#fedc03]/5 shadow-sm'
                                        : 'border-border bg-card hover:border-[#fedc03]/30 hover:bg-secondary/30'
                                )}
                            >
                                {/* Checkbox — stop propagation so click doesn't navigate */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleSelect(enrollment.id); }}
                                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {isSelected
                                        ? <CheckSquare className="w-4 h-4 text-[#0a0a0a]" />
                                        : <Square className="w-4 h-4" />}
                                </button>

                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-background">
                                    {enrollment.avatarUrl
                                        ? <img src={enrollment.avatarUrl} alt={enrollment.name ?? ''} className="w-full h-full object-cover" />
                                        : <span className="text-sm font-bold text-muted-foreground">{(enrollment.name ?? 'I')[0].toUpperCase()}</span>}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm">{enrollment.name ?? 'Influencer'}</span>
                                        {enrollment.handle && (
                                            <span className="text-xs text-muted-foreground">@{enrollment.handle}</span>
                                        )}
                                        {enrollment.hasBeenInvited && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fedc03]/15 text-[#0a0a0a] border border-[#fedc03]/30">
                                                <UserCheck className="w-3 h-3" />
                                                {alreadyInvitedIds.length > 1 ? `${alreadyInvitedIds.length} campaigns` : 'Invited'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {enrollment.tier && (
                                            <span className="text-[11px] capitalize px-1.5 py-0.5 rounded bg-secondary/80 text-muted-foreground font-medium">
                                                {enrollment.tier}
                                            </span>
                                        )}
                                        {enrollment.followerCount && (
                                            <span className="text-[11px] text-muted-foreground">
                                                {(enrollment.followerCount / 1000).toFixed(1)}K followers
                                            </span>
                                        )}
                                        {enrollment.niches && enrollment.niches.length > 0 && (
                                            <span className="text-[11px] text-muted-foreground truncate">
                                                {enrollment.niches.slice(0, 2).join(', ')}
                                            </span>
                                        )}
                                    </div>
                                    {enrollment.note && (
                                        <p className="text-xs text-muted-foreground mt-1.5 px-2 py-1 bg-secondary/50 rounded-lg border border-border/50 italic line-clamp-1">
                                            "{enrollment.note}"
                                        </p>
                                    )}
                                </div>

                                {/* Invite button — stop propagation so click doesn't navigate */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); canInvite && requireCompleteProfile() && setInviteTarget(enrollment.id); }}
                                    disabled={!canInvite}
                                    title={
                                        !hasProgramCampaigns ? 'Create a campaign for this program first' :
                                        allInvited ? 'Already invited to all campaigns in this program' :
                                        'Invite to a campaign'
                                    }
                                    className={cn(
                                        'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                        canInvite
                                            ? 'bg-[#fedc03]/15 border border-[#fedc03]/40 text-[#0a0a0a] hover:bg-[#fedc03]/25 hover:border-[#fedc03]/60'
                                            : 'bg-secondary/50 border border-border text-muted-foreground cursor-not-allowed opacity-40'
                                    )}
                                >
                                    {allInvited
                                        ? <><UserCheck className="w-3.5 h-3.5" />All Invited</>
                                        : <><Send className="w-3.5 h-3.5" />Invite</>}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
                <div className="sticky bottom-4 flex items-center justify-between gap-3 p-4 rounded-2xl border border-[#fedc03]/50 bg-card/95 backdrop-blur-md shadow-xl shadow-black/10 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#fedc03]/20 flex items-center justify-center">
                            <CheckSquare className="w-3.5 h-3.5 text-[#0a0a0a]" />
                        </div>
                        <span className="text-sm font-bold">
                            {selectedIds.size} creator{selectedIds.size > 1 ? 's' : ''} selected
                        </span>
                        <button
                            onClick={clearSelection}
                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => requireCompleteProfile() && setBulkInviteOpen(true)}
                            disabled={!hasProgramCampaigns}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fedc03] text-[#1a1100] text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-sm"
                        >
                            <Send className="w-3.5 h-3.5" />
                            Invite to Campaign
                        </button>
                    </div>
                </div>
            )}

            {inviteTarget && (
                <InviteToCampaignModal
                    programId={programId}
                    enrollmentIds={[inviteTarget]}
                    alreadyInvitedCampaignIds={
                        enrolledList.find((e) => e.id === inviteTarget)?.invitedCampaignIds ?? []
                    }
                    onClose={() => setInviteTarget(null)}
                />
            )}

            {bulkInviteOpen && (
                <InviteToCampaignModal
                    programId={programId}
                    enrollmentIds={Array.from(selectedIds)}
                    onClose={() => { setBulkInviteOpen(false); clearSelection(); }}
                />
            )}

            {previewInfluencerId && (
                <InfluencerPreviewModal
                    influencerId={previewInfluencerId}
                    onClose={() => setPreviewInfluencerId(null)}
                />
            )}
        </div>
    );
}

// ─── Program Detail Page ──────────────────────────────────────────────────────

export default function ProgramDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = useState<'campaigns' | 'enrollments'>('campaigns');

    const { data: program, isLoading, error } = useProgram(id!);
    const { mutate: updateProgram } = useUpdateProgram();
    const navigate = useNavigate();
    const { data: campaignsData } = useCampaigns({ limit: 100 });
    const { data: enrollments = [] } = useEnrollments(id!);
    // Refresh the enrollment list and header counts the moment someone enrols.
    useProgramEnrollmentRealtime(id);

    const handleToggleEnrollment = () => {
        if (!id || !program) return;
        updateProgram({ id, enrollmentOpen: !program.enrollmentOpen });
    };

    if (isLoading) {
        return (
            <div className="w-full space-y-8 animate-fade-in pb-16">
                {/* Back button skeleton */}
                <div className="h-8 w-32 bg-secondary rounded-lg animate-pulse" />

                {/* Hero Card Skeleton */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
                    <div className="w-full h-48 sm:h-64 bg-secondary" />
                    <div className="p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-2">
                                <div className="h-7 w-64 bg-secondary rounded-lg" />
                                <div className="h-4 w-96 max-w-full bg-secondary rounded" />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-28 bg-secondary rounded-lg" />
                                <div className="h-9 w-28 bg-secondary rounded-lg" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Tabs Skeleton */}
                <div className="space-y-4">
                    <div className="flex gap-2 border-b border-border pb-2">
                        <div className="h-8 w-24 bg-secondary rounded-lg animate-pulse" />
                        <div className="h-8 w-24 bg-secondary rounded-lg animate-pulse" />
                        <div className="h-8 w-24 bg-secondary rounded-lg animate-pulse" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-xl border border-border bg-card p-5 h-36 animate-pulse space-y-3">
                                <div className="h-4 w-1/2 bg-secondary rounded" />
                                <div className="h-3 w-3/4 bg-secondary rounded" />
                                <div className="h-3 w-1/3 bg-secondary rounded mt-auto" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error || !program) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-sm text-destructive">Failed to load program.</p>
            </div>
        );
    }

    const programCampaigns = (campaignsData?.data ?? []).filter((c: any) => c.programId === id);
    const campaignCount    = programCampaigns.length;
    const ENDED_STATUSES = new Set(['completed', 'closed', 'withdrawn', 'expired']);
    const activeCampaigns = programCampaigns.filter((c: any) => !ENDED_STATUSES.has(getCampaignDisplayStatus(c)));
    const endedCampaigns  = programCampaigns.filter((c: any) =>  ENDED_STATUSES.has(getCampaignDisplayStatus(c)));
    // Prefer the agent-scoped totalBudget from the API when the local campaign list
    // is empty (campaigns reassigned away from this agent return no rows).
    const localBudget = programCampaigns.reduce((sum: number, c: any) => {
        const b = typeof c.budget?.total === 'number' ? c.budget.total
                : typeof c.budgetTotal === 'number'   ? c.budgetTotal
                : typeof c.budgetTotal === 'string'   ? Number(c.budgetTotal) || 0
                : 0;
        return sum + b;
    }, 0);
    const totalBudget = programCampaigns.length > 0 ? localBudget : (program.totalBudget ?? 0);
    const enrolledList    = (enrollments as ProgramEnrollment[]).filter(e => e.status !== 'withdrawn');
    const enrollmentCount = enrolledList.length;
    const acceptedCount   = enrolledList.filter(e => e.hasBeenInvited === true).length;

    return (
        <div className="w-full animate-fade-in space-y-6">
            {/* Back */}
            <button
                onClick={() => navigate('/programs')}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
                <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Hero card */}
            <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
                {/* Subtle gradient accent */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#fedc03]/5 via-transparent to-transparent pointer-events-none" />

                <div className="relative p-6">
                    <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                            {/* Thumbnail */}
                            {program.thumbnailUrl ? (
                                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-border bg-secondary shrink-0 shadow-sm">
                                    <ApiImage src={program.thumbnailUrl} alt={program.name} className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-2xl border border-[#fedc03]/30 bg-[#fedc03]/10 shrink-0 flex items-center justify-center shadow-sm">
                                    <span className="text-2xl font-black text-[#fedc03]">{program.name.charAt(0).toUpperCase()}</span>
                                </div>
                            )}

                            <div className="min-w-0 pt-0.5">
                                <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight truncate">{program.name}</h1>
                                {program.description && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 max-w-lg">{program.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className={cn(
                                        'px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                                        program.status === 'active'    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                        program.status === 'paused'    ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                                        program.status === 'completed' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                        'bg-muted text-muted-foreground border-border'
                                    )}>
                                        {program.status.charAt(0).toUpperCase() + program.status.slice(1)}
                                    </span>
                                    {program.enrollmentOpen && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                            Enrolling
                                        </span>
                                    )}
                                    {program.niches && program.niches.length > 0 && program.niches.slice(0, 2).map((n) => (
                                        <span key={n} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border capitalize">
                                            {n}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <Link
                            to={`/campaigns/create?programId=${program.id}`}
                            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white border border-border text-foreground text-sm font-bold hover:bg-secondary/60 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Create Campaign
                        </Link>
                    </div>

                    {/* Stats row — inside the hero card */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/60">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/50">
                            <div className="w-8 h-8 rounded-lg bg-[#fedc03]/15 flex items-center justify-center shrink-0">
                                <Wallet className="w-4 h-4 text-[#0a0a0a]" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Budget</p>
                                <p className="text-sm font-bold">₹{totalBudget.toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/50">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                <Megaphone className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Campaigns</p>
                                <p className="text-sm font-bold">{campaignCount}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/50">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                                <Users className="w-4 h-4 text-violet-500" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Enrolled</p>
                                <p className="text-sm font-bold">{enrollmentCount}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/50">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                <Trophy className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Invited</p>
                                <p className="text-sm font-bold text-emerald-600">{acceptedCount}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs: Campaigns | Enrollments */}
            <div className="space-y-4">
                {/* Tab nav */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border/50 w-fit">
                    <button
                        onClick={() => setActiveTab('campaigns')}
                        className={cn(
                            'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
                            activeTab === 'campaigns'
                                ? 'bg-card shadow-sm text-foreground border border-border/60'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Megaphone className="w-3.5 h-3.5" />
                        Campaigns
                        {campaignCount > 0 && (
                            <span className={cn(
                                'px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center',
                                activeTab === 'campaigns'
                                    ? 'bg-[#fedc03] text-[#1a1100]'
                                    : 'bg-secondary text-muted-foreground',
                            )}>
                                {campaignCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('enrollments')}
                        className={cn(
                            'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
                            activeTab === 'enrollments'
                                ? 'bg-card shadow-sm text-foreground border border-border/60'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Enrollments
                        {enrollmentCount > 0 && (
                            <span className={cn(
                                'px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center',
                                activeTab === 'enrollments'
                                    ? 'bg-[#fedc03] text-[#1a1100]'
                                    : 'bg-secondary text-muted-foreground',
                            )}>
                                {enrollmentCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Tab content */}
                {activeTab === 'campaigns' ? (
                    programCampaigns.length === 0 ? (
                        <div className="p-8 rounded-2xl border border-dashed border-border bg-secondary/20 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                                <Megaphone className="w-5 h-5 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm font-semibold mb-1">No campaigns yet</p>
                            <p className="text-xs text-muted-foreground mb-4">Create campaigns linked to this program to invite enrolled creators.</p>
                            <Link
                                to={`/campaigns/create?programId=${program.id}`}
                                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white border border-border text-foreground text-sm font-bold hover:bg-secondary/60 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Create First Campaign
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Active / in-progress campaigns */}
                            {activeCampaigns.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {activeCampaigns.map((campaign: any) => (
                                        <CampaignCard key={campaign.id} campaign={campaign} />
                                    ))}
                                </div>
                            )}

                            {/* Completed / closed campaigns */}
                            {endedCampaigns.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-px flex-1 bg-border/60" />
                                        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">
                                            Expired & Completed
                                        </span>
                                        <div className="h-px flex-1 bg-border/60" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-60">
                                        {endedCampaigns.map((campaign: any) => (
                                            <CampaignCard key={campaign.id} campaign={campaign} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    <div className="rounded-2xl border border-border bg-card overflow-hidden">
                        <div className="p-5">
                            <EnrollmentsPanel
                                programId={id!}
                                enrollmentOpen={program.enrollmentOpen ?? false}
                                onToggleEnrollment={handleToggleEnrollment}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
