import { useMemo, useState } from 'react';
import { Check, X, Pencil, Loader2, AlertTriangle, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import type { AssistantProposal } from '@/shared/types/assistant';

/**
 * The confirm gate. Nothing the assistant proposed has touched the database when this renders
 * — clicking Create is the only thing that writes, and it runs through the same campaign and
 * invite services a manual click would.
 *
 * The card is editable on purpose: the user's edits are saved as `formState` and it is
 * formState, not the model's original payload, that gets executed.
 */

const KIND_LABELS: Record<AssistantProposal['kind'], { title: string; cta: string }> = {
    create_campaign: { title: 'Campaign draft ready', cta: 'Create draft' },
    update_campaign: { title: 'Changes ready', cta: 'Apply changes' },
    invite_creators: { title: 'Invites ready', cta: 'Send invites' },
};

function fmtINR(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** YYYY-MM-DD as something readable. Parsed as UTC so it never shifts a day by timezone. */
function fmtDate(value: unknown): string {
    const raw = String(value ?? '');
    if (!raw) return '—';
    const d = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

interface EditableField {
    path: [string, string];
    label: string;
    value: string;
    multiline?: boolean;
    /** 'date' renders a native picker, so a timeline is corrected rather than retyped. */
    type?: 'text' | 'date';
}

export function AssistantProposalCard({
    proposal,
    onConfirm,
    onReject,
    onSaveDraft,
}: {
    proposal: AssistantProposal;
    onConfirm: (id: string) => Promise<{ campaignId?: string; campaignName?: string; message: string }>;
    onReject: (id: string) => Promise<void>;
    onSaveDraft: (id: string, formState: Record<string, unknown>) => Promise<void>;
}) {
    const state = (proposal.formState ?? proposal.payload) as Record<string, unknown>;
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState<Record<string, unknown>>(state);
    const [busy, setBusy] = useState<'confirm' | 'reject' | 'save' | null>(null);

    const labels = KIND_LABELS[proposal.kind];
    const basics = (draft.basics ?? {}) as Record<string, unknown>;
    const budget = (draft.budget ?? {}) as Record<string, unknown>;
    const deliverables = (draft.deliverables ?? {}) as Record<string, unknown>;
    const summary = (state._summary ?? {}) as Record<string, unknown>;

    const tierConfig = Array.isArray(budget.tierConfig) ? budget.tierConfig : [];

    const editableFields: EditableField[] = useMemo(() => {
        if (proposal.kind !== 'create_campaign') return [];
        return [
            { path: ['basics', 'campaignName'], label: 'Campaign name', value: String(basics.campaignName ?? '') },
            { path: ['basics', 'description'], label: 'Description', value: String(basics.description ?? ''), multiline: true },
            { path: ['basics', 'location'], label: 'Location', value: String(basics.location ?? '') },
            // Only on a brand-script campaign, which is the only kind that carries one. It is
            // editable here because the campaign is created with it, and because a script the
            // user pasted into the chat is exactly the thing they may want to tidy before
            // committing.
            // Editable so a brand that asked for private and got public can fix it on the card
            // rather than discovering it in the builder after the campaign already exists.
            { path: ['basics', 'visibility'], label: 'Visibility (public or private)', value: String(basics.visibility ?? '') },
            ...(deliverables.scriptType === 'brand'
                ? [{ path: ['deliverables', 'scriptFlow'] as [string, string], label: 'Script', value: String(deliverables.scriptFlow ?? ''), multiline: true }]
                : []),
            // Editable here because the campaign is created with these dates. When the user did
            // not name a timeline the server fills one in, and finding that out only later in
            // the builder made the schedule feel like something decided behind their back.
            { path: ['budget', 'applicationDeadline'], label: 'Applications close', value: String(budget.applicationDeadline ?? ''), type: 'date' },
            { path: ['budget', 'scriptDeadline'], label: 'Scripts due', value: String(budget.scriptDeadline ?? ''), type: 'date' },
            { path: ['budget', 'workDeadline'], label: 'Work submission due', value: String(budget.workDeadline ?? ''), type: 'date' },
            // Only offered when the draft actually carries a proof-of-work stage. It is opt-in,
            // so showing an empty date row on every campaign would invite the user to fill in a
            // deadline for a stage the campaign does not run.
            ...(budget.proofOfWorkDeadline
                ? [{ path: ['budget', 'proofOfWorkDeadline'] as [string, string], label: 'Proof of work due', value: String(budget.proofOfWorkDeadline), type: 'date' as const }]
                : []),
        ];
    }, [proposal.kind, basics, budget, deliverables]);

    const updateField = (path: [string, string], value: string) => {
        setDraft((prev) => ({
            ...prev,
            [path[0]]: { ...((prev[path[0]] ?? {}) as Record<string, unknown>), [path[1]]: value },
        }));
    };

    const saveEdits = async () => {
        setBusy('save');
        try {
            await onSaveDraft(proposal.id, draft);
            setIsEditing(false);
            toast.success('Draft updated');
        } catch {
            toast.error('Could not save those edits.');
        } finally {
            setBusy(null);
        }
    };

    const confirm = async () => {
        setBusy('confirm');
        try {
            // Persist any unsaved edits first, so what executes is what is on screen.
            if (isEditing) await onSaveDraft(proposal.id, draft);
            const outcome = await onConfirm(proposal.id);
            toast.success(outcome.message);
        } catch (err) {
            // Surface the real reason — a plan limit or validation failure is actionable,
            // "something went wrong" is not.
            const message = (err as { response?: { data?: { error?: { message?: string } } } })
                ?.response?.data?.error?.message;
            toast.error(message || 'Could not complete that.');
        } finally {
            setBusy(null);
        }
    };

    /**
     * Dismissing takes two clicks.
     *
     * It sat one pixel from Create draft, fired instantly, and left nothing behind but a grey
     * caption — so a mis-click silently destroyed the draft AND every step that hangs off it
     * (the cover image, the handoff to preview). One user then spent eleven turns typing "yes
     * confirm" at an assistant that could no longer see a card either.
     */
    const [confirmingReject, setConfirmingReject] = useState(false);

    const reject = async () => {
        if (!confirmingReject) {
            setConfirmingReject(true);
            return;
        }
        setBusy('reject');
        try {
            await onReject(proposal.id);
        } catch {
            toast.error('Could not dismiss that.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="bg-card border-2 border-primary/60 rounded-xl p-4 animate-fade-in">
            <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="text-sm font-bold">{labels.title}</h4>
                {proposal.kind === 'create_campaign' ? (
                    <button
                        type="button"
                        onClick={() => setIsEditing((v) => !v)}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                        <Pencil className="w-3 h-3" />
                        {isEditing ? 'Done editing' : 'Edit'}
                    </button>
                ) : null}
            </div>

            {proposal.kind === 'create_campaign' ? (
                <>
                    {isEditing ? (
                        <div className="space-y-3 mb-3">
                            {editableFields.map((f) => (
                                <div key={f.path.join('.')}>
                                    <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                                        {f.label}
                                    </label>
                                    {f.multiline ? (
                                        <Textarea
                                            value={String(((draft[f.path[0]] ?? {}) as Record<string, unknown>)[f.path[1]] ?? '')}
                                            onChange={(e) => updateField(f.path, e.target.value)}
                                            rows={3}
                                            className="mt-1 text-xs"
                                        />
                                    ) : (
                                        <Input
                                            type={f.type ?? 'text'}
                                            value={String(((draft[f.path[0]] ?? {}) as Record<string, unknown>)[f.path[1]] ?? '')}
                                            onChange={(e) => updateField(f.path, e.target.value)}
                                            className="mt-1 h-9 text-xs"
                                        />
                                    )}
                                </div>
                            ))}
                            <Button size="sm" variant="outline" onClick={saveEdits} disabled={busy !== null} className="w-full">
                                {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                                Save edits
                            </Button>
                        </div>
                    ) : (
                        <div className="mb-3">
                            <p className="text-sm font-semibold">{String(basics.campaignName ?? 'Untitled')}</p>
                            <p className="text-xs text-muted-foreground mt-1">{String(basics.description ?? '')}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {[
                                    String(basics.type ?? ''),
                                    String(deliverables.platform ?? ''),
                                    String(basics.location ?? ''),
                                    budget.totalBudget != null ? fmtINR(budget.totalBudget) : '',
                                    // Shown because the campaign is created with it and it was
                                    // invisible until the builder — a brand that asked for a
                                    // private campaign had no way to see it had come out public
                                    // until after they had confirmed the card.
                                    String(basics.visibility ?? ''),
                                ].filter(Boolean).map((chip) => (
                                    <span key={chip} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary capitalize">
                                        {chip}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {tierConfig.length > 0 ? (
                        <div className="rounded-lg bg-secondary/50 p-2.5 mb-3">
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                                Creator mix
                            </p>
                            {tierConfig.map((raw, i) => {
                                const t = raw as Record<string, unknown>;
                                return (
                                    <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                        <span className="capitalize">{String(t.tier)} × {String(t.count)}</span>
                                        <span className="font-medium">{fmtINR(t.amount)} each</span>
                                    </div>
                                );
                            })}
                            {summary.unallocated != null && Number(summary.unallocated) > 0 ? (
                                <p className="text-[10px] text-muted-foreground mt-1.5">
                                    {fmtINR(summary.unallocated)} left unallocated
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    {/* The timeline the campaign will actually be created with, shown up front.
                        It was previously invisible until the builder, so a schedule the user had
                        never been asked about appeared as a fait accompli. Editable via Edit. */}
                    {budget.applicationDeadline || budget.scriptDeadline || budget.workDeadline || budget.proofOfWorkDeadline ? (
                        <div className="rounded-lg bg-secondary/50 p-2.5 mb-3">
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                                Timeline
                            </p>
                            {([
                                ['Applications close', budget.applicationDeadline],
                                ['Scripts due', budget.scriptDeadline],
                                ['Work submission due', budget.workDeadline],
                                ['Proof of work due', budget.proofOfWorkDeadline],
                            ] as Array<[string, unknown]>)
                                .filter(([, value]) => Boolean(value))
                                .map(([label, value]) => (
                                    <div key={label} className="flex items-center justify-between text-xs py-0.5">
                                        <span>{label}</span>
                                        <span className="font-medium">{fmtDate(value)}</span>
                                    </div>
                                ))}
                        </div>
                    ) : null}

                    {/* Stated plainly rather than discovered later in the builder. */}
                    <div className="flex items-start gap-2 rounded-lg bg-secondary/50 p-2.5 mb-3">
                        <ImageOff className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-[11px] text-muted-foreground">
                            This creates a <span className="font-semibold text-foreground">draft</span>. Next I will
                            ask you for a cover image here in the chat, then take you to the preview.
                        </p>
                    </div>

                    {summary.planNote ? (
                        <div className="flex items-start gap-2 rounded-lg border border-border p-2.5 mb-3">
                            <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <p className="text-[11px] text-muted-foreground">{String(summary.planNote)}</p>
                        </div>
                    ) : null}
                </>
            ) : (
                <p className="text-xs text-muted-foreground mb-3">
                    {String(summary.summary ?? summary.reason ?? `${summary.count ?? ''} creators`)}
                </p>
            )}

            <div className="flex gap-2">
                <Button size="sm" onClick={confirm} disabled={busy !== null} className="flex-1">
                    {busy === 'confirm' ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {labels.cta}
                </Button>
                {confirmingReject ? (
                    <Button size="sm" variant="outline" onClick={() => setConfirmingReject(false)} disabled={busy !== null}>
                        Keep it
                    </Button>
                ) : null}
                <Button
                    size="sm"
                    variant="outline"
                    onClick={reject}
                    disabled={busy !== null}
                    className={cn(confirmingReject && 'border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700')}
                >
                    {busy === 'reject' ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                        <X className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {confirmingReject ? 'Discard draft' : 'Dismiss'}
                </Button>
            </div>
            {confirmingReject ? (
                <p className="text-[11px] text-muted-foreground mt-2">
                    This throws the draft away — the assistant will have to build it again.
                </p>
            ) : null}
        </div>
    );
}
