import { useRef, useState } from 'react';
import { FileText, Loader2, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUploadScript } from '@/modules/campaigns/hooks/useCampaigns';

/**
 * The script for a brand-script campaign, collected HERE rather than in the builder.
 *
 * "Brand script" means the brand writes it, so a campaign carrying that choice owes the
 * creators an actual document. assertLaunchable refuses to launch one without either an
 * uploaded file or 30+ characters of script text — so a draft that skipped this met the
 * requirement for the first time at the launch button, with nothing in the conversation
 * explaining where it came from.
 *
 * The chat asks for the text before drafting (propose_campaign refuses a brand-script draft
 * without it). This panel is the other half: a FILE cannot be attached before the campaign
 * exists, because POST /campaigns/:id/script needs an id — exactly the constraint that puts the
 * cover-image step after Confirm too. So anyone who would rather hand over a PDF than paste
 * their script does it here, in the same breath, instead of hunting for the control in the
 * builder.
 */

// Mirrors the builder's own script-file rules, so a file accepted here is never rejected by
// the page the user lands on next.
const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];

export function AssistantScriptStep({
    campaignId,
    campaignName,
    onDone,
}: {
    campaignId: string;
    campaignName?: string;
    onDone: (uploaded: boolean) => void;
}) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const uploadScript = useUploadScript();

    const pick = (picked: File | undefined | null) => {
        if (!picked) return;
        const name = picked.name.toLowerCase();
        if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
            setError('Only PDF, DOC, DOCX and TXT files are allowed.');
            return;
        }
        if (picked.size > MAX_BYTES) {
            setError('Script file must be 100MB or smaller.');
            return;
        }
        setError(null);
        setFile(picked);
    };

    const attach = async () => {
        if (!file) return;
        try {
            await uploadScript.mutateAsync({ id: campaignId, file });
            onDone(true);
        } catch {
            // Kept on screen rather than moving on: the campaign exists either way, and a
            // brand-script campaign with no script cannot be launched, so silently continuing
            // would strand them at a launch button that refuses with no explanation.
            setError('That upload did not go through. Try again, or skip and add the script in the builder.');
        }
    };

    const busy = uploadScript.isPending;

    return (
        <div className="rounded-xl border-2 border-primary/60 bg-card p-4 animate-fade-in">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#fedc03] text-black flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">Attach your script file</p>
                    <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">
                        {campaignName ? `"${campaignName}" is saved as a draft. ` : 'Your draft is saved. '}
                        You chose to provide the script, so creators need it before this can go live.
                    </p>
                </div>
            </div>

            {file ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-[13px] font-medium truncate flex-1">{file.name}</span>
                    <button
                        type="button"
                        onClick={() => setFile(null)}
                        disabled={busy}
                        aria-label="Remove file"
                        className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-premium disabled:opacity-50 shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                    className={cn(
                        'mt-3 w-full rounded-lg border-2 border-dashed py-6 flex flex-col items-center gap-1.5 transition-premium',
                        error ? 'border-red-500' : 'border-border hover:border-primary/50 hover:bg-secondary',
                    )}
                >
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[13px] font-medium">Choose a script file</span>
                    <span className="text-[11px] text-muted-foreground">PDF, DOC, DOCX or TXT</span>
                </button>
            )}

            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                    pick(e.target.files?.[0]);
                    // Cleared so re-picking the same file after a validation error still fires.
                    e.target.value = '';
                }}
            />

            {error ? <p className="text-[12px] text-red-500 mt-2">{error}</p> : null}

            <div className="flex flex-wrap gap-2 mt-3">
                <button
                    type="button"
                    onClick={attach}
                    disabled={!file || busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-premium disabled:opacity-40"
                >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {busy ? 'Uploading…' : 'Attach script'}
                </button>
                <button
                    type="button"
                    onClick={() => onDone(false)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-premium disabled:opacity-50"
                >
                    Skip for now
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
