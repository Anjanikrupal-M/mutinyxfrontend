import { X, Mail, FileText } from 'lucide-react';
import { useInfluencer } from '@/modules/discover/hooks/useInfluencers';

interface MOUTemplateProps {
    influencerId: string;
    campaignName: string;
    campaignType: string;
    agreedBudget: number;
    platformFeePercent: number;
    brandName?: string;
    onSendEmail: () => void;
    onClose: () => void;
}

export function MOUTemplate({
    influencerId,
    campaignName,
    campaignType,
    agreedBudget,
    platformFeePercent,
    brandName = 'Your Brand',
    onSendEmail,
    onClose,
}: MOUTemplateProps) {
    const { data: influencer } = useInfluencer(influencerId);
    const platformFee = agreedBudget * (platformFeePercent / 100);
    const total = agreedBudget + platformFee;
    const firstPayment = total / 2;
    const finalPayment = total / 2;
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            <div
                className="relative bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <h3 className="text-base font-bold font-display">Memorandum of Understanding</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-premium">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* MOU Content */}
                <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
                    <div className="border border-border rounded-xl p-5 bg-background text-sm space-y-4">
                        <div className="text-center border-b border-border pb-4">
                            <h4 className="text-base font-bold font-display">Campaign Collaboration Agreement</h4>
                            <p className="text-xs text-muted-foreground mt-1">Date: {today}</p>
                        </div>

                        <div>
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Parties</h5>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg bg-secondary/30">
                                    <p className="text-[10px] text-muted-foreground">Brand</p>
                                    <p className="font-semibold text-xs">{brandName}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-secondary/30">
                                    <p className="text-[10px] text-muted-foreground">Influencer</p>
                                    <p className="font-semibold text-xs">{influencer?.userName || 'N/A'}</p>
                                    <p className="text-[10px] text-muted-foreground">{influencer?.handle}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Campaign Details</h5>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Campaign</span><span className="font-medium">{campaignName}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{campaignType}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Platform</span><span className="font-medium capitalize">{influencer?.platforms?.[0]?.platform}</span></div>
                            </div>
                        </div>

                        <div>
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Payment Terms</h5>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Creator Budget</span><span className="font-medium">₹{agreedBudget.toLocaleString('en-IN')}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Platform Fee ({platformFeePercent}%)</span><span className="font-medium">₹{platformFee.toLocaleString('en-IN')}</span></div>
                                <div className="flex justify-between border-t border-border pt-1.5"><span className="text-muted-foreground">Total</span><span className="font-bold">₹{total.toLocaleString('en-IN')}</span></div>
                            </div>
                        </div>

                        <div className="bg-[#fedc03]/5 border border-[#fedc03]/20 rounded-lg p-3">
                            <h5 className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Payment Schedule</h5>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">1. On Acceptance (50%)</span>
                                    <span className="font-medium">₹{firstPayment.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">2. After Work Approval (50%)</span>
                                    <span className="font-medium">₹{finalPayment.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            This agreement is auto-generated by the platform. The influencer's payout will be processed by the platform admin after the brand approves the final work submission. Platform fee is non-refundable upon campaign withdrawal.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border shrink-0">
                    <button
                        onClick={onSendEmail}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#fedc03] text-black text-sm font-bold hover:opacity-90 transition-premium"
                    >
                        <Mail className="w-4 h-4" />
                        Send MOU via Email
                    </button>
                </div>
            </div>
        </div>
    );
}
