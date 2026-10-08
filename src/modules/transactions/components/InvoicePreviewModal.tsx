import { useEffect, useState } from 'react';
import { Download, ExternalLink, Loader2, FileWarning } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/shared/ui/dialog';
import {
    fetchInvoiceObjectUrl, invoiceFileName, saveObjectUrl, type Transaction,
} from '../hooks/useTransactions';

interface InvoicePreviewModalProps {
    transaction: Transaction | null;
    onClose: () => void;
}

/**
 * Renders the invoice PDF inline so a brand can read it before deciding to save it.
 *
 * The PDF is fetched once as a blob and shown from an object URL — the API route is
 * authenticated, so pointing the iframe straight at it would render a 401 page. The same
 * blob backs Download and Open in new tab, so neither re-hits the server.
 */
export function InvoicePreviewModal({ transaction, onClose }: InvoicePreviewModalProps) {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!transaction) return;

        let cancelled = false;
        let created: string | null = null;

        setObjectUrl(null);
        setFailed(false);

        fetchInvoiceObjectUrl(transaction)
            .then((url) => {
                created = url;
                // The modal may have closed while the request was in flight; releasing the
                // URL here avoids leaking a blob nobody will ever render.
                if (cancelled) {
                    URL.revokeObjectURL(url);
                    return;
                }
                setObjectUrl(url);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });

        return () => {
            cancelled = true;
            if (created) URL.revokeObjectURL(created);
        };
    }, [transaction]);

    const open = transaction !== null;

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="max-w-4xl w-[95vw] p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-5 py-4 border-b border-border">
                    <DialogTitle className="text-base">Invoice</DialogTitle>
                    <DialogDescription className="text-xs">
                        {transaction
                            ? `${transaction.campaignName} · Final payment`
                            : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-secondary/40 h-[65vh] flex items-center justify-center">
                    {failed ? (
                        <div className="flex flex-col items-center gap-2 text-center px-6">
                            <FileWarning className="w-8 h-8 text-muted-foreground" />
                            <p className="text-sm font-medium">Couldn't load this invoice</p>
                            <p className="text-xs text-muted-foreground max-w-xs">
                                The document could not be generated right now. Please try again in a moment.
                            </p>
                        </div>
                    ) : !objectUrl ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <p className="text-xs">Preparing invoice...</p>
                        </div>
                    ) : (
                        <iframe
                            src={objectUrl}
                            title="Invoice preview"
                            className="w-full h-full border-0 bg-white"
                        />
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
                    <button
                        onClick={() => objectUrl && window.open(objectUrl, '_blank', 'noopener')}
                        disabled={!objectUrl}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary transition-premium disabled:opacity-50"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Open in new tab
                    </button>
                    <button
                        onClick={() => {
                            if (objectUrl && transaction) saveObjectUrl(objectUrl, invoiceFileName(transaction));
                        }}
                        disabled={!objectUrl}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-2 text-sm font-medium hover:opacity-90 transition-premium disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        Download
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
