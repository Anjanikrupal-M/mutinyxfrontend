import { useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Kind = 'script' | 'work' | 'proof';

interface CopyReviewLinkButtonProps {
    kind: Kind;
    shareToken?: string | null;
    /** Disable when the submission has already been reviewed (link is dead). */
    disabled?: boolean;
    className?: string;
}

/**
 * Copies the public review URL for a submission to the clipboard. Lets the
 * brand share a one-time link with anyone (no auth needed) so they can
 * accept / request revision on this exact submission.
 */
export function CopyReviewLinkButton({ kind, shareToken, disabled, className }: CopyReviewLinkButtonProps) {
    const [justCopied, setJustCopied] = useState(false);

    if (!shareToken) return null;

    const handleCopy = async () => {
        const url = `${window.location.origin}/review/${kind}/${shareToken}`;
        try {
            await navigator.clipboard.writeText(url);
            setJustCopied(true);
            toast.success('Review link copied to clipboard');
            setTimeout(() => setJustCopied(false), 1800);
        } catch {
            // Fallback for older browsers / restricted contexts.
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                setJustCopied(true);
                toast.success('Review link copied to clipboard');
                setTimeout(() => setJustCopied(false), 1800);
            } catch {
                toast.error('Could not copy link. Long-press to copy manually.');
            } finally {
                document.body.removeChild(ta);
            }
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            disabled={disabled}
            title={disabled ? 'Link expires after the first review' : 'Copy a public review link to share with anyone'}
            className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-xs font-bold hover:bg-secondary transition-premium disabled:opacity-50 disabled:cursor-not-allowed',
                className,
            )}
        >
            {justCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Link2 className="w-3.5 h-3.5" />}
            {justCopied ? 'Copied' : 'Copy review link'}
            {!justCopied && <Copy className="w-3 h-3 opacity-50" />}
        </button>
    );
}
