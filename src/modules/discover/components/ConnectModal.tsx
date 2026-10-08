import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown, Plus, LockKeyhole, Globe, Send, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useInviteInfluencer } from '../hooks/useInfluencers';
import { useCampaigns } from '@/modules/campaigns/hooks/useCampaigns';
import { useApplications } from '@/modules/campaigns/hooks/useApplications';
import { StatusBadge } from '@/shared/components/StatusBadge';

const TYPE_ICONS: Record<string, string> = { influencer: '📸', ugc: '🎥', meme: '😂', twitter: '🐦' };

interface ConnectModalProps {
    influencerId: string;
    influencerName: string;
    profileComplete?: boolean;
    profileCompletionIssues?: string[];
    defaultCampaignId?: string | null;
    onClose: () => void;
}

export function ConnectModal({
    influencerId,
    influencerName,
    profileComplete = true,
    profileCompletionIssues = [],
    defaultCampaignId,
    onClose,
}: ConnectModalProps) {
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(defaultCampaignId || null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [sent, setSent] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const navigate = useNavigate();

    const { data: campaignsData } = useCampaigns();
    const campaigns = campaignsData?.data ?? [];
    const { data: linkedInfluencers = [] } = useApplications(selectedCampaignId || '');
    const inviteMutation = useInviteInfluencer();

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Only show private campaigns that are active or draft
    const eligibleCampaigns = useMemo(() =>
        campaigns.filter((c) =>
            c.visibility === 'private' && (c.status === 'active' || c.status === 'draft')
        ),
        [campaigns]);

    const selectedCampaign = eligibleCampaigns.find((c) => c.id === selectedCampaignId);
    const isAlreadyLinked = linkedInfluencers.some((ci) => String(ci.influencerId) === String(influencerId));
    const canSendInvite = profileComplete;

    const formatCampaignBudget = (campaign: any) => {
        const mode = String(campaign?.budgetMode ?? campaign?.budget?.mode ?? '').toLowerCase();
        if (mode === 'product' || mode === 'paid_product') return 'Product Only';

        const budgetTotal = Number(campaign?.budgetTotal ?? campaign?.budget?.total ?? 0);
        if (Number.isFinite(budgetTotal) && budgetTotal > 0) {
            return `₹${budgetTotal.toLocaleString('en-IN')}`;
        }

        const tierPricing = campaign?.budgetTierPricing ?? campaign?.budget?.tierPricing ?? [];
        const tierValues = (Array.isArray(tierPricing) ? tierPricing : [])
            .map((tp: any) => Number(tp?.amount ?? tp?.rate ?? 0))
            .filter((v: number) => Number.isFinite(v) && v > 0);

        if (tierValues.length > 0) {
            return `₹${tierValues.map((v: number) => v.toLocaleString('en-IN')).join(' / ')}`;
        }

        return 'N/A';
    };

    const formatDeadline = (value?: string | null) => {
        if (!value) return '—';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return '—';
        return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    // Invites only go to private campaigns, so open the builder as private and carry the creator through as `ref`.
    const handleCreateCampaign = () => {
        onClose();
        navigate(`/campaigns/create?${new URLSearchParams({ fresh: 'true', visibility: 'private', ref: influencerId })}`);
    };

    const handleSendConnect = async () => {
        if (!selectedCampaignId || inviteMutation.isPending) return;

        if (isAlreadyLinked) {
            toast.info('This influencer is already invited to this campaign.');
            return;
        }
        
        const toastId = toast.loading('Sending connect request...');
        
        inviteMutation.mutate({
            influencerId,
            campaignId: selectedCampaignId,
            message: '',
        }, {
            onSuccess: () => {
                toast.success('Connect request sent!', { id: toastId });
                setSent(true);
                setTimeout(() => onClose(), 1500);
            },
            onError: (error: any) => {
                const msg = error.response?.data?.message || 'Failed to send connect request';
                toast.error(msg, { id: toastId });
            }
        });
    };

    // Portal to <body>: this is a hand-rolled `fixed` overlay, and pages wrap their content in
    // `.animate-fade-in`, whose lingering `transform: scale(1)` (fill-mode `both`) would otherwise
    // become the containing block for this fixed overlay and clip the campaign dropdown at the
    // page-box edge. Rendering at <body> escapes that transformed ancestor.
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />


            <div
                className="relative bg-card border border-border rounded-2xl shadow-xl max-w-md w-full animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div>
                        <h3 className="text-base font-bold font-display">Connect with {influencerName}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Select a campaign to start collaboration</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-premium">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-5">
                    {sent ? (
                        <div className="text-center py-6 animate-fade-in">
                            <div className="w-14 h-14 rounded-full bg-[#fedc03]/10 flex items-center justify-center mx-auto mb-3">
                                <Send className="w-6 h-6 text-[#fedc03]" />
                            </div>
                            <h4 className="text-sm font-bold font-display mb-1">Connect Request Sent!</h4>
                            <p className="text-xs text-muted-foreground">
                                {influencerName} will receive your campaign invite.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Campaign Dropdown */}
                            <div className="mb-4">
                                <label className="text-xs font-semibold text-muted-foreground mb-2 block">Campaign</label>
                                <div className="relative">
                                    <button
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className={cn(
                                            'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm text-left transition-premium',
                                            isDropdownOpen ? 'border-foreground' : 'border-border hover:border-foreground/20'
                                        )}
                                    >
                                        {selectedCampaign ? (
                                            <div className="flex items-center gap-2 truncate">
                                                <span>{TYPE_ICONS[selectedCampaign.type]}</span>
                                                <span className="font-medium truncate">{selectedCampaign.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">Select a campaign…</span>
                                        )}
                                        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isDropdownOpen && 'rotate-180')} />
                                    </button>

                                    {isDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-2xl shadow-lg z-10 overflow-hidden animate-fade-in">
                                            <div className="max-h-60 overflow-y-auto py-1">
                                                {eligibleCampaigns.length === 0 ? (
                                                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                                                        No private campaigns available
                                                    </p>
                                                ) : (
                                                    eligibleCampaigns.map((c) => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => {
                                                                setSelectedCampaignId(c.id);
                                                                setIsDropdownOpen(false);
                                                            }}
                                                            className={cn(
                                                                'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-secondary transition-premium',
                                                                selectedCampaignId === c.id && 'bg-secondary/50'
                                                            )}
                                                        >
                                                            <span>{TYPE_ICONS[c.type]}</span>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-medium truncate">{c.name}</p>
                                                                <p className="text-[10px] text-muted-foreground">{(c.niche ?? []).join(', ') || '—'}</p>
                                                            </div>
                                                            <StatusBadge status={c.status} />
                                                        </button>
                                                    ))
                                                )}
                                            </div>

                                            {/* Create new */}
                                            <div className="border-t border-border">
                                                <button
                                                    onClick={handleCreateCampaign}
                                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-secondary transition-premium text-left"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Create New Campaign
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Campaign Preview */}
                            {selectedCampaign && (
                                <div className="bg-secondary/30 rounded-xl p-4 mb-4 animate-fade-in">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-semibold">{selectedCampaign.name}</h4>
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <LockKeyhole className="w-3 h-3" />
                                            Private
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <p className="text-muted-foreground">Type</p>
                                            <p className="font-medium capitalize">{selectedCampaign.type}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Budget</p>
                                            <p className="font-medium">{formatCampaignBudget(selectedCampaign)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Creators</p>
                                            <p className="font-medium">{selectedCampaign.creatorsAccepted}/{selectedCampaign.creatorsInvited}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Deadline</p>
                                            <p className="font-medium">{formatDeadline(selectedCampaign.deadline)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!profileComplete && (
                                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                        Incomplete profile cannot accept this invite.
                                    </p>
                                    {profileCompletionIssues.length > 0 && (
                                        <p className="mt-1 text-[11px] text-amber-700/90 dark:text-amber-200/90">
                                            Missing: {profileCompletionIssues.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Send button */}
                            <button
                                onClick={handleSendConnect}
                                disabled={!selectedCampaignId || inviteMutation.isPending || !canSendInvite || isAlreadyLinked}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fedc03] text-black text-sm font-bold hover:opacity-90 transition-premium disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Send className="w-4 h-4" />
                                {inviteMutation.isPending
                                    ? 'Sending...'
                                    : isAlreadyLinked
                                        ? 'Already Invited'
                                        : canSendInvite
                                            ? 'Send Connect Request'
                                            : 'Profile Incomplete'}
                            </button>

                            {selectedCampaignId && isAlreadyLinked && (
                                <p className="mt-2 text-[11px] text-muted-foreground text-center">
                                    This creator is already linked to the selected campaign.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
