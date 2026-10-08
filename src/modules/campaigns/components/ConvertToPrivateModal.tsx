import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LockKeyhole, X, UserRoundX, Loader2, Globe, EyeOff, Users, ArrowRight } from 'lucide-react';
import type { Campaign } from '@/shared/types/campaign';
import { useCurrentSubscription } from '@/modules/subscription/hooks/useSubscription';
import { useUpdateCampaign } from '../hooks/useCampaigns';

interface ConvertToPrivateModalProps {
    campaign: Campaign | { id: string; name: string };
    onClose: () => void;
    /** Called after the campaign is switched to private. */
    onConverted?: () => void;
    /** 'general' for voluntary switch; 'replace_creator' when triggered by replacing a creator. */
    reason?: 'general' | 'replace_creator';
}

/**
 * Modal to switch a public campaign to private at any time.
 * Covers all edge cases:
 * 1. Immediate marketplace delisting (no new uninvited applications).
 * 2. Existing applications carried forward as they are.
 * 3. Direct invites enabled (brand can invite specific creators with custom rates).
 * 4. Permanent one-way change notice.
 * 5. Free-plan users are prompted to upgrade (private campaigns require paid plan).
 */
export function ConvertToPrivateModal({ campaign, onClose, onConverted, reason = 'general' }: ConvertToPrivateModalProps) {
    const navigate = useNavigate();
    const { data: subscription } = useCurrentSubscription();
    const isFreePlan = subscription?.plan === 'free';
    const updateCampaign = useUpdateCampaign();

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [onClose]);

    const handleConvert = () => {
        if (updateCampaign.isPending) return;
        updateCampaign.mutate(
            { id: campaign.id, visibility: 'private' },
            {
                onSuccess: () => {
                    toast.success('Campaign switched to Private. You can now send direct invites.');
                    onClose();
                    onConverted?.();
                },
                onError: (err: any) => {
                    const apiError = err?.response?.data?.error;
                    if (apiError?.code === 'PLAN_UPGRADE_REQUIRED') {
                        toast.error(apiError.message ?? 'Private campaigns require a paid plan.', {
                            action: { label: 'View plans', onClick: () => navigate('/subscription') },
                        });
                        return;
                    }
                    toast.error(apiError?.message ?? 'Failed to switch the campaign to private.');
                },
            }
        );
    };

    const isReplacement = reason === 'replace_creator';

    const modal = (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="convert-private-title"
                className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-5 border-b border-border">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                {isReplacement ? <UserRoundX className="w-5 h-5" /> : <LockKeyhole className="w-5 h-5" />}
                            </div>
                            <div>
                                <h2 id="convert-private-title" className="text-base font-bold font-display leading-tight">
                                    {isReplacement ? 'Replacement needs a private campaign' : 'Switch Campaign to Private'}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs sm:max-w-sm">
                                    "{campaign.name}" is currently public.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-premium shrink-0 -mt-0.5"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {isReplacement ? (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Replacing a creator works through direct invites, which are only available on private
                            campaigns. Switch this campaign to private to use the replacement feature.
                        </p>
                    ) : (
                        <p className="text-sm text-foreground/90 leading-relaxed">
                            Switching this campaign to <strong className="text-foreground">Private (Invite-Only)</strong> changes how creators discover and join:
                        </p>
                    )}

                    {/* Edge-case guidance cards */}
                    <div className="space-y-2.5 rounded-xl bg-secondary/30 border border-border p-3.5 text-xs text-muted-foreground">
                        <div className="flex items-start gap-2.5">
                            <EyeOff className="w-4 h-4 text-foreground shrink-0 mt-0.5" />
                            <div>
                                <strong className="text-foreground">Marketplace Delisting:</strong> The campaign will immediately be hidden from the public creator discovery feed. New uninvited creators cannot find or apply.
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                                <strong className="text-foreground">Existing Applications Preserved:</strong> All current applicants remain untouched in your pipeline. You can review, approve, or decline them as normal.
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <Globe className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <div>
                                <strong className="text-foreground">Direct Invites Enabled:</strong> You can directly invite specific creators and agree on custom rates rather than fixed public tiers.
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5 pt-1 border-t border-border/60">
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                Tier pricing and creator-size settings are cleared, and there is no option to switch back to public.
                            </span>
                        </div>
                    </div>

                    {isFreePlan ? (
                        <div className="space-y-2 pt-1">
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                Private campaigns require a paid Brand or Agency plan.
                            </p>
                            <button
                                type="button"
                                onClick={() => { onClose(); navigate('/subscription'); }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-premium"
                            >
                                <LockKeyhole className="w-4 h-4" />
                                View Subscription Plans
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={updateCampaign.isPending}
                                className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary transition-premium"
                            >
                                Keep Public
                            </button>

                            <button
                                type="button"
                                disabled={updateCampaign.isPending}
                                onClick={handleConvert}
                                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-premium shadow-xs"
                            >
                                {updateCampaign.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>Switch to Private</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
