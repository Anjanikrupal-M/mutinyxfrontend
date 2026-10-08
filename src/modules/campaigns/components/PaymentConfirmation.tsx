import { X, CreditCard, Check, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInfluencer } from '@/modules/discover/hooks/useInfluencers';

interface PaymentConfirmationProps {
    influencerId: string;
    campaignName: string;
    agreedBudget: number;
    platformFeePercent: number;
    onConfirm: () => void;
    onClose: () => void;
}

export function PaymentConfirmation({
    influencerId,
    campaignName,
    agreedBudget,
    platformFeePercent,
    onConfirm,
    onClose,
}: PaymentConfirmationProps) {
    const { data: influencer } = useInfluencer(influencerId);
    const platformFee = agreedBudget * (platformFeePercent / 100);
    const totalWithFee = agreedBudget + platformFee;
    const amountDue = totalWithFee / 2;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            <div
                className="relative bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h3 className="text-base font-bold font-display">Confirm Payment</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-premium">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-5 py-5 space-y-4">
                    {/* Campaign & Influencer */}
                    <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center text-lg font-bold mx-auto mb-2">
                            {influencer?.userName?.charAt(0) || '?'}
                        </div>
                        <p className="text-sm font-semibold">{influencer?.userName}</p>
                        <p className="text-xs text-muted-foreground">{campaignName}</p>
                    </div>

                    {/* Breakdown */}
                    <div className="bg-secondary/30 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Creator Budget</span>
                            <span className="font-medium">₹{agreedBudget.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Platform Fee ({platformFeePercent}%)</span>
                            <span className="font-medium">₹{platformFee.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="border-t border-border pt-2 flex justify-between text-xs">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-semibold">₹{totalWithFee.toLocaleString('en-IN')}</span>
                        </div>
                    </div>

                    {/* Amount due */}
                    <div className="bg-[#fedc03]/5 border border-[#fedc03]/20 rounded-xl p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">50% Due Now</p>
                        <p className="text-2xl font-bold font-display">₹{amountDue.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Remaining 50% due after work approval</p>
                    </div>

                    {/* Security note */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        <span>Payments are held securely until work is approved</span>
                    </div>

                    {/* Actions */}
                    <button
                        onClick={onConfirm}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fedc03] text-black text-sm font-bold hover:opacity-90 transition-premium"
                    >
                        <CreditCard className="w-4 h-4" />
                        Pay ₹{amountDue.toLocaleString('en-IN')}
                    </button>
                </div>
            </div>
        </div>
    );
}
