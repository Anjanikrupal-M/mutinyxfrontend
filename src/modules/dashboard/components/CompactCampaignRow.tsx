import { Link } from 'react-router-dom';
import { Users, Video, Smile, MessageSquare, LucideIcon, Wallet, Users2 } from 'lucide-react';
import { CampaignStatusBadge } from '@/modules/campaigns/components/CampaignStatusBadge';
import { ApiImage } from '@/shared/components/ApiImage';
import type { Campaign } from '@/shared/types/campaign';

const TYPE_ICONS: Record<string, LucideIcon> = {
    influencer: Users,
    ugc: Video,
    meme: Smile,
    twitter: MessageSquare,
};

function toNumber(v: unknown): number {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}

interface Props {
    campaign: Campaign;
}

export function CompactCampaignRow({ campaign }: Props) {
    const Icon = TYPE_ICONS[campaign.type] || Users;
    const coverUrl = campaign.thumbnailUrl || campaign.thumbnail;
    const budget = toNumber(campaign.budgetTotal ?? campaign.budget?.total);

    return (
        <Link
            to={`/campaigns/${campaign.id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/40 transition-premium group"
        >
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary shrink-0 flex items-center justify-center">
                {coverUrl ? (
                    <ApiImage src={coverUrl} alt={campaign.name} className="w-full h-full object-cover" />
                ) : (
                    <Icon className="w-4 h-4 text-muted-foreground/50" />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-foreground">{campaign.name}</p>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Users2 className="w-3 h-3" />
                        {campaign.creatorsAccepted || 0}
                    </span>
                    <span className="flex items-center gap-1">
                        <Wallet className="w-3 h-3" />
                        ₹{(budget / 1000).toFixed(0)}K
                    </span>
                    {campaign.location && <span className="truncate hidden sm:inline">{campaign.location}</span>}
                </div>
            </div>

            <CampaignStatusBadge campaign={campaign} />
        </Link>
    );
}
