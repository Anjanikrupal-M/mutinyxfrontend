import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Globe, LockKeyhole, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentSubscription } from '@/modules/subscription/hooks/useSubscription';

interface CampaignVisibilityModalProps {
    open: boolean;
    onClose: () => void;
    /** Extra query params carried into the builder (e.g. { ref: influencerId }). */
    extraParams?: Record<string, string>;
    /** Raise the stacking order when opened on top of another overlay (e.g. ConnectModal at z-50). */
    stackAbove?: boolean;
}

/**
 * Asks whether a new campaign is public or private *before* the builder opens, so the
 * wizard can commit to one flow. The choice is passed on as `?visibility=`, which the
 * builder locks in — there is no visibility picker inside the wizard.
 *
 * Private campaigns require a Brand/Agencies plan (see subscriptions.guards.ts
 * assertCanCreatePrivateCampaign); free-plan users get an upgrade prompt instead.
 *
 * Rendered via React Portal at document.body so it is always above ALL stacking
 * contexts (including the sidebar at z-[100] and AppShell's overflow-x-hidden context).
 */
export function CampaignVisibilityModal({
    open,
    onClose,
    extraParams,
    stackAbove = false,
}: CampaignVisibilityModalProps) {
    const navigate = useNavigate();
    const { data: subscription } = useCurrentSubscription();
    const isFreePlan = subscription?.plan === 'free';

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        // Prevent background scroll while modal is open
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open, onClose]);

    if (!open) return null;

    const goToBuilder = (visibility: 'public' | 'private') => {
        const params = new URLSearchParams({ fresh: 'true', visibility, ...extraParams });
        navigate(`/campaigns/create?${params.toString()}`);
        onClose();
    };

    const modal = (
        <div
            className={cn(
                'fixed inset-0 flex items-center justify-center p-4',
                stackAbove ? 'z-[9999]' : 'z-[9998]'
            )}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
            {/* Full-viewport backdrop — blurs and dims everything including sidebar */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="campaign-visibility-title"
                className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-5 border-b border-border">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                                <h2 id="campaign-visibility-title" className="text-base font-bold font-display leading-tight">
                                    Who can see this campaign?
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    This sets up the rest of the builder and can't be changed later.
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

                {/* Options */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Public */}
                    <button
                        type="button"
                        onClick={() => goToBuilder('public')}
                        className="group flex flex-col items-start gap-3 p-4 rounded-xl border border-border text-left hover:border-foreground/40 hover:bg-secondary/20 transition-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                    >
                        <div className="w-9 h-9 rounded-xl bg-secondary group-hover:bg-secondary/80 flex items-center justify-center transition-premium">
                            <Globe style={{ width: '1.125rem', height: '1.125rem' }} className="text-muted-foreground group-hover:text-foreground transition-premium" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold leading-tight">Public</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-snug">
                                Any creator can discover this campaign and apply. You set the budget by creator tier.
                            </p>
                        </div>
                    </button>

                    {/* Private */}
                    {isFreePlan ? (
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                navigate('/subscription');
                            }}
                            className="group relative flex flex-col items-start gap-3 p-4 rounded-xl border border-border text-left opacity-60 hover:opacity-100 hover:border-foreground/40 hover:bg-secondary/20 transition-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                        >
                            <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground px-1.5 py-0.5 rounded-md bg-secondary border border-border">
                                <LockKeyhole className="w-2.5 h-2.5" />
                                Upgrade
                            </span>
                            <div className="w-9 h-9 rounded-xl bg-secondary group-hover:bg-secondary/80 flex items-center justify-center transition-premium">
                                <LockKeyhole style={{ width: '1.125rem', height: '1.125rem' }} className="text-muted-foreground group-hover:text-foreground transition-premium" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold leading-tight">Private</p>
                                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                                    Invite-only campaigns are on the Brand and Agencies plans. Tap to see plans.
                                </p>
                            </div>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => goToBuilder('private')}
                            className="group flex flex-col items-start gap-3 p-4 rounded-xl border border-border text-left hover:border-foreground/40 hover:bg-secondary/20 transition-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                        >
                            <div className="w-9 h-9 rounded-xl bg-secondary group-hover:bg-secondary/80 flex items-center justify-center transition-premium">
                                <LockKeyhole style={{ width: '1.125rem', height: '1.125rem' }} className="text-muted-foreground group-hover:text-foreground transition-premium" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold leading-tight">Private</p>
                                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                                    Nobody sees it until you invite them. You set each creator's fee yourself.
                                </p>
                            </div>
                        </button>
                    )}
                </div>

                {/* Footer hint */}
                <div className="px-4 pb-4">
                    <p className="text-[11px] text-muted-foreground text-center">
                        You can always create more campaigns after this one.
                    </p>
                </div>
            </div>
        </div>
    );

    // Render via Portal at document.body — bypasses ALL parent stacking contexts
    // (AppShell overflow-x-hidden, sidebar z-[100], etc.)
    return createPortal(modal, document.body);
}
