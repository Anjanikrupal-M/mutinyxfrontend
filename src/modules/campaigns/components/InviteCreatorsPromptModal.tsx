import { Send, Rocket } from 'lucide-react';

interface InviteCreatorsPromptModalProps {
    open: boolean;
    /** Go to the campaign's invite page. */
    onInvite: () => void;
    /** Skip for now — go to the campaign detail page. */
    onLater: () => void;
}

/**
 * Shown after a private campaign launches. Private campaigns are invisible until the brand
 * invites creators, so launching alone accomplishes nothing — this nudges them to the
 * invite step while giving an explicit way out.
 *
 * Intentionally has no backdrop dismiss or close button: both paths navigate, so an
 * ambiguous third "do nothing" exit would strand the user on a stale builder.
 */
export function InviteCreatorsPromptModal({ open, onInvite, onLater }: InviteCreatorsPromptModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="invite-prompt-title"
                className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl animate-fade-in text-center"
            >
                <div className="w-12 h-12 rounded-2xl bg-brand/20 flex items-center justify-center mx-auto mb-4">
                    <Rocket className="w-6 h-6 text-foreground" />
                </div>

                <h2 id="invite-prompt-title" className="text-lg font-bold font-display">
                    Your campaign is live
                </h2>
                <p className="text-xs text-muted-foreground mt-2 mb-6">
                    It's private, so no one can see it until you invite them. Want to add creators now?
                </p>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onLater}
                        className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold hover:bg-secondary/50 transition-premium"
                    >
                        Later
                    </button>
                    <button
                        type="button"
                        onClick={onInvite}
                        className="flex-1 h-10 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-premium flex items-center justify-center gap-2"
                    >
                        <Send className="w-3.5 h-3.5" />
                        Invite creators
                    </button>
                </div>
            </div>
        </div>
    );
}
