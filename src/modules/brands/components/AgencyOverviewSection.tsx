import { toast } from 'sonner';
import { Building2, Loader2, Megaphone, Rocket, Users } from 'lucide-react';
import { StatCard } from '@/shared/components/StatCard';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn, formatCompactCurrency } from '@/lib/utils';
import { getBrandRoleLabel, useSwitchBrand } from '@/shared/hooks/useBrandProfiles';
import { useAgencyOverview } from '../hooks/useAgencyOverview';

// Read-only cross-brand summary for the agency head — campaign activity per brand plus
// who manages what, without switching into each brand individually. Adding/reassigning
// owners and switching brands themselves still live in their own tabs.
export function AgencyOverviewSection() {
    const { data, isLoading } = useAgencyOverview(true);
    const { mutate: switchBrand, isPending: isSwitching, variables: switchingBrandId } = useSwitchBrand();

    if (isLoading || !data) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const { brands, owners, totals } = data;
    const campaignCountByBrandId = new Map(brands.map((b) => [b.id, b.campaignCount]));

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Building2} label="Total brands" value={totals.brandCount} />
                <StatCard icon={Users} label="Team members" value={totals.ownerCount} />
                <StatCard icon={Megaphone} label="Total campaigns" value={totals.campaignCount} />
                <StatCard icon={Rocket} label="Active campaigns" value={totals.activeCampaignCount} />
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                    <h3 className="text-base font-semibold font-display">Brand activity</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Campaign activity across every brand you own or manage.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                <th className="px-6 py-2.5 font-medium">Brand</th>
                                <th className="px-4 py-2.5 font-medium text-right">Campaigns</th>
                                <th className="px-4 py-2.5 font-medium text-right">Active</th>
                                <th className="px-4 py-2.5 font-medium text-right">Budget</th>
                                <th className="px-4 py-2.5 font-medium text-right">Spent</th>
                                <th className="px-6 py-2.5 font-medium text-right">&nbsp;</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {brands.map((brand, index) => (
                                <tr key={brand.id}>
                                    <td className="px-6 py-3">
                                        <p className="font-medium truncate max-w-[220px]">{brand.brandName}</p>
                                        <Badge
                                            variant={brand.relation === 'managed' ? 'secondary' : index === 0 ? 'default' : 'outline'}
                                            className="text-[10px] mt-1"
                                        >
                                            {getBrandRoleLabel(brand, index)}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">{brand.campaignCount}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{brand.activeCampaignCount}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">₹{formatCompactCurrency(brand.totalBudget)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">₹{formatCompactCurrency(brand.totalSpent)}</td>
                                    <td className="px-6 py-3 text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={brand.isActive || (isSwitching && switchingBrandId === brand.id)}
                                            onClick={() =>
                                                switchBrand(brand.id, {
                                                    onError: () => toast.error('Failed to switch brand. Please try again.'),
                                                })
                                            }
                                        >
                                            {isSwitching && switchingBrandId === brand.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : brand.isActive ? (
                                                'Managing'
                                            ) : (
                                                'Switch'
                                            )}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                    <h3 className="text-base font-semibold font-display">Team members</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{owners.length} team member{owners.length !== 1 ? 's' : ''} managing brands on your behalf.</p>
                </div>
                {owners.length === 0 ? (
                    <div className="px-6 py-10 text-center">
                        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium">No team members yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Add one from a brand's Team section.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {owners.map((owner) => (
                            <div key={owner.id} className="flex items-center justify-between px-6 py-3.5 gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                                        {owner.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{owner.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{owner.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {owner.brands.length > 0 ? (
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                            {owner.brands.reduce((sum, b) => sum + (campaignCountByBrandId.get(b.id) ?? 0), 0)} campaigns
                                        </span>
                                    ) : null}
                                    <div className="flex flex-wrap gap-1 justify-end max-w-[220px]">
                                        {owner.brands.length > 0 ? (
                                            owner.brands.map((b) => (
                                                <span key={b.id} className="text-xs px-2 py-0.5 rounded-full font-medium bg-secondary text-foreground border border-border">
                                                    {b.brandName}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                No brand assigned
                                            </span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        'text-xs px-2 py-0.5 rounded-full font-medium',
                                        owner.isActive ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground',
                                    )}>
                                        {owner.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
