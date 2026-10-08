import { useState } from 'react';
import { Check, Copy, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCampaignShareTokens } from '../hooks/useCampaignShareTokens';

type Kind = 'script' | 'work' | 'proof';

interface CopyBulkReviewLinkButtonProps {
    kind: Kind;
    campaignId: string;
    className?: string;
    /**
     * When true, the button stays disabled and shows an explanatory tooltip
     * (e.g. when there are no submissions of this kind yet — nothing to share).
     */
    disabled?: boolean;
    /** Optional tooltip override when `disabled` is set externally. */
    disabledReason?: string;
}

const TOKEN_FIELD: Record<Kind, 'scriptReviewToken' | 'workReviewToken' | 'proofReviewToken'> = {
    script: 'scriptReviewToken',
    work: 'workReviewToken',
    proof: 'proofReviewToken',
};

/**
 * Copies the campaign-level public review URL for the given kind. Anyone with
 * the link can view + accept/reject every submission of that kind for this
 * campaign without logging in.
 */
export function CopyBulkReviewLinkButton({
    kind,
    campaignId,
    className,
    disabled: disabledProp,
    disabledReason,
}: CopyBulkReviewLinkButtonProps) {
    // Only fetch the token when the parent says there's something to share.
    // Otherwise the GET happens needlessly for empty tabs and surfaces a token
    // for nothing.
    const { data, isLoading } = useCampaignShareTokens(disabledProp ? undefined : campaignId);
    const [justCopied, setJustCopied] = useState(false);

    const token = data?.[TOKEN_FIELD[kind]] ?? null;
    const disabled = Boolean(disabledProp) || isLoading || !token;
    const tooltip = disabledProp
        ? (disabledReason ?? `No ${kind === 'proof' ? 'proof of work' : kind} submissions yet — nothing to share.`)
        : isLoading
            ? 'Preparing the bulk review link…'
            : 'Copy a single link that lets anyone review every submission in this tab without logging in';

    const handleCopy = async () => {
        if (!token) {
            toast.error('Review link is not ready yet. Please try again in a moment.');
            return;
        }
        const url = `${window.location.origin}/review/campaign/${kind}/${token}`;
        try {
            await navigator.clipboard.writeText(url);
            setJustCopied(true);
            toast.success('Bulk review link copied to clipboard');
            setTimeout(() => setJustCopied(false), 1800);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                setJustCopied(true);
                toast.success('Bulk review link copied to clipboard');
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
            title={tooltip}
            className={cn(
                'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-xs font-bold hover:bg-secondary transition-premium disabled:opacity-60 disabled:cursor-not-allowed',
                className,
            )}
        >
            {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : justCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
                <Link2 className="w-3.5 h-3.5" />
            )}
            {justCopied ? 'Copied' : `Copy bulk ${kind} review link`}
            {!justCopied && !isLoading && <Copy className="w-3 h-3 opacity-50" />}
        </button>
    );
}
