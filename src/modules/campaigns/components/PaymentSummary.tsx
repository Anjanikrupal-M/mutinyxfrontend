import type { PaymentRoundSummary } from '../hooks/usePayments';

interface PaymentSummaryProps {
    title: string;
    summary: PaymentRoundSummary;
}

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

export function PaymentSummary({ title, summary }: PaymentSummaryProps) {
    // Creator replacement: the backend's influencerTotal is already NET of carried
    // advance credit — show the gross first so the minus line adds up visually.
    const carriedCredit = summary.carriedCreditTotal ?? 0;
    const grossInfluencerTotal = summary.influencerTotal + carriedCredit;
    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 bg-secondary/40 px-3.5 py-2.5">
                <h4 className="text-[13px] font-semibold">{title}</h4>
                <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
                    {summary.count} creator{summary.count === 1 ? '' : 's'}
                </span>
            </div>
            <dl className="space-y-2 px-3.5 py-3 text-[13px]">
                <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Influencer total</dt>
                    <dd className="font-medium tabular-nums">{rupees(grossInfluencerTotal)}</dd>
                </div>
                {carriedCredit > 0 && (
                    <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Covered by carried advance</dt>
                        <dd className="font-medium tabular-nums text-emerald-600">− {rupees(carriedCredit)}</dd>
                    </div>
                )}
                <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Platform fee</dt>
                    <dd className="font-medium tabular-nums">{rupees(summary.platformFee)}</dd>
                </div>
            </dl>
            <div className="flex justify-between gap-3 border-t border-border/70 px-3.5 py-2.5 text-sm font-semibold">
                <span>Grand total</span>
                <span className="tabular-nums">{rupees(summary.grandTotal)}</span>
            </div>
        </div>
    );
}
