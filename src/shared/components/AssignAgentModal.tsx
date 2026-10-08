import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTeamMembers } from '@/modules/brands/hooks/useTeam';

interface AssignAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (agentId: string | null) => Promise<void>;
    currentAgentId?: string | null;
    itemName: string;
    /** Brand the campaign/program being assigned belongs to. Required: the backend only
     *  accepts an assignee who manages THIS brand (campaigns.service assignAgent checks
     *  brand_managers), but GET /team returns every team member across all the agency's
     *  brands. Without this filter the modal happily offers members from other brands and
     *  the assign call 400s. */
    brandId: string | undefined;
    /** Team member to leave out of the candidate list. Set when reassigning work AWAY
     *  from someone (the member detail page) — offering them back is a no-op that
     *  reads as "nothing happened". */
    excludeAgentId?: string | null;
}

export function AssignAgentModal({ isOpen, onClose, onAssign, currentAgentId, itemName, brandId, excludeAgentId }: AssignAgentModalProps) {
    const { data: agents = [], isLoading } = useTeamMembers();
    const [selectedAgent, setSelectedAgent] = useState<string | null>(currentAgentId ?? null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Callers keep this mounted and just flip `isOpen`, so the useState initializer only
    // ever runs once — with whatever currentAgentId happened to be at first render
    // (usually null). Without this sync the modal opens showing the wrong current
    // assignee, and keeps the previous item's selection on the next open.
    useEffect(() => {
        if (isOpen) setSelectedAgent(currentAgentId ?? null);
    }, [isOpen, currentAgentId]);

    // Only members who manage this brand can be assigned its work — the backend rejects
    // anyone else with a 400. Deactivated members can't take on work either, but keep the
    // current assignee visible even if they've since been deactivated or been unassigned
    // from the brand — otherwise the modal misreports today's state.
    const candidates = useMemo(
        () =>
            agents.filter(
                (a) =>
                    a.id !== excludeAgentId &&
                    (a.id === currentAgentId ||
                        (a.isActive && !!brandId && a.brands.some((b) => b.id === brandId))),
            ),
        [agents, excludeAgentId, currentAgentId, brandId],
    );

    if (!isOpen) return null;

    const isUnchanged = selectedAgent === (currentAgentId ?? null);

    const handleAssign = async (agentId: string | null) => {
        setIsSubmitting(true);
        try {
            await onAssign(agentId);
            onClose();
        } catch (err) {
            // Neither assign mutation toasts on error, so without this the modal just
            // sits there after a failed request with no indication anything went wrong.
            // Prefer the backend's own message — it says WHY (e.g. the assignee doesn't
            // manage this brand), which a generic retry prompt hides.
            const message = (err as { response?: { data?: { error?: { message?: string } } } })
                ?.response?.data?.error?.message;
            toast.error(message ?? 'Could not update the assignment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const modal = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-card rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <Users className="w-5 h-5 text-muted-foreground" />
                            Who runs {itemName}?
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Pick the team member responsible for it. This changes who manages
                            the work — it doesn't change anyone's access.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {candidates.length === 0 && (
                                <p className="text-center py-6 text-muted-foreground text-sm">
                                    {agents.length === 0
                                        ? 'No team members yet. You can add them from the Settings page.'
                                        : 'No active team members manage this brand yet. Assign someone to it first.'}
                                </p>
                            )}

                            {candidates.map((agent) => (
                                <div
                                    key={agent.id}
                                    onClick={() => setSelectedAgent(agent.id)}
                                    className={cn(
                                        "p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between",
                                        selectedAgent === agent.id 
                                            ? "border-foreground bg-muted" 
                                            : "border-border hover:border-foreground/30"
                                    )}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                                    </div>
                                    <div className={cn(
                                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-3",
                                        selectedAgent === agent.id ? "border-foreground" : "border-border"
                                    )}>
                                        {selectedAgent === agent.id && <div className="w-2 h-2 rounded-full bg-foreground" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-border bg-muted/30 shrink-0 flex items-center justify-end gap-3">
                    {/* The only way back to "nobody assigned" — shown only when someone is. */}
                    {currentAgentId && (
                        <button
                            onClick={() => handleAssign(null)}
                            disabled={isSubmitting}
                            className="mr-auto text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50"
                        >
                            Unassign
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleAssign(selectedAgent)}
                        // Saving the assignee it already has is a wasted round-trip that
                        // looks like a no-op to the user.
                        disabled={isSubmitting || isLoading || isUnchanged}
                        title={isUnchanged ? 'Pick a different team member first' : undefined}
                        className="flex items-center gap-2 px-6 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
