import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { API } from '@/core/api';
import http from '@/core/http';

import { Loader2, CalendarClock, Briefcase, Package } from 'lucide-react';
import { ApiImage } from '@/shared/components/ApiImage';

// Tab components from CampaignDetailPage
import { OverviewTab } from '@/modules/campaigns/pages/CampaignDetailPage';
import { ApplicationsTab } from '@/modules/campaigns/components/ApplicationsTab';
import { KanbanBoard } from '@/modules/campaigns/components/KanbanBoard';
import { ScriptsTab } from '@/modules/campaigns/components/ScriptsTab';
import { WorkSubmissionsTab } from '@/modules/campaigns/components/WorkSubmissionsTab';
import { ProofOfWorkTab } from '@/modules/campaigns/components/ProofOfWorkTab';
import { AnalyticsTab } from '@/modules/campaigns/components/AnalyticsTab';
import { BarChart3, Users, Kanban, FileText, Send, Award, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CampaignStatusBadge } from '@/modules/campaigns/components/CampaignStatusBadge';

const TABS = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'applications', label: 'Applications', icon: Users },
    { key: 'kanban', label: 'Status Board', icon: Kanban },
    { key: 'scripts', label: 'Scripts', icon: FileText },
    { key: 'submissions', label: 'Work Submissions', icon: Send },
    { key: 'proof-of-work', label: 'Proof of Work', icon: Award },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
];

export default function PublicCampaignOverviewPage() {
    const { token } = useParams<{ token: string }>();
    const [activeTab, setActiveTab] = useState('overview');

    const { data, isLoading, error } = useQuery({
        queryKey: ['campaign-overview', token],
        queryFn: async () => {
            const res = await http.get(API.publicReview.campaignOverview(token!));
            return res.data?.data ?? res.data;
        },
        enabled: Boolean(token),
        retry: 1,
    });

    useEffect(() => {
        if (data?.campaign?.name) {
            document.title = `${data.campaign.name} - Read-Only Overview`;
        }
        return () => {
            document.title = 'MutinyX';
        };
    }, [data?.campaign?.name]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary/60 flex items-center justify-center mb-4">
                    <Award className="w-8 h-8 text-muted-foreground" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold mb-2">Link Expired or Invalid</h1>
                <p className="text-muted-foreground text-sm max-w-sm">
                    This campaign overview link may have expired or is incorrect.
                </p>
            </div>
        );
    }

    const { campaign, applications, scripts, works, proofs } = data;
    // 'none' = script not required, so there is no Scripts tab either.
    const isBrandScript = campaign.scriptType === 'brand' || campaign.scriptType === 'none' || Boolean(campaign.scriptFlow) || Boolean(campaign.scriptFileKey);

    const visibleTabs = TABS.filter((t) => {
        if (t.key === 'scripts' && isBrandScript) return false;
        return true;
    });

    return (
        <div className="min-h-screen bg-background">
            <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6">

                {/* Header Section */}
                <div className="pb-5 sm:pb-6 border-b border-border">
                    <div className="flex items-start gap-3 sm:gap-4">
                        {/* Thumbnail */}
                        {(campaign.thumbnailUrl || campaign.thumbnail) ? (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-border bg-secondary shrink-0 flex items-center justify-center p-0.5">
                                <ApiImage
                                    src={campaign.thumbnailUrl || campaign.thumbnail}
                                    alt={campaign.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-border bg-secondary shrink-0 flex items-center justify-center">
                                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#fedc03]" />
                            </div>
                        )}

                        {/* Title + meta */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                            {/* Campaign name + badges — wrap on small screens */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight leading-tight">
                                    {campaign.name}
                                </h1>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <CampaignStatusBadge campaign={campaign} />
                                    <span className="px-2 py-0.5 bg-secondary/60 text-muted-foreground text-[10px] sm:text-xs font-semibold rounded-full uppercase tracking-wider whitespace-nowrap">
                                        Read Only
                                    </span>
                                </div>
                            </div>

                            {/* Campaign meta row */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-muted-foreground font-medium">
                                <div className="flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                        {campaign.type === 'ugc' ? 'UGC Marketing' :
                                            campaign.type === 'meme' ? 'Meme Marketing' : 'Influencer Marketing'}
                                    </span>
                                </div>
                                <div className="w-1 h-1 rounded-full bg-border hidden sm:block" />
                                <div className="flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5 shrink-0" />
                                    <span>{campaign.platform || 'Multi-platform'}</span>
                                </div>
                                {campaign.deadline && (
                                    <>
                                        <div className="w-1 h-1 rounded-full bg-border hidden sm:block" />
                                        <div className="flex items-center gap-1.5">
                                            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                                            <span>{new Date(campaign.deadline).toLocaleDateString()}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                    {visibleTabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-premium relative whitespace-nowrap shrink-0',
                                activeTab === tab.key
                                    ? 'text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                            {activeTab === tab.key && (
                                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#fedc03] rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="animate-fade-in">
                    {activeTab === 'overview' && (
                        <OverviewTab campaign={campaign} influencers={applications} isReadOnly={true} />
                    )}
                    {activeTab === 'applications' && (
                        <ApplicationsTab
                            campaign={campaign}
                            applications={applications}
                            isReadOnly={true}
                        />
                    )}
                    {activeTab === 'kanban' && (
                        <KanbanBoard
                            campaign={campaign}
                            applications={applications}
                            isReadOnly={true}
                        />
                    )}
                    {activeTab === 'scripts' && (
                        <ScriptsTab
                            campaign={campaign}
                            scripts={scripts}
                            isReadOnly={true}
                        />
                    )}
                    {activeTab === 'submissions' && (
                        <WorkSubmissionsTab
                            campaign={campaign}
                            submissions={works}
                            isReadOnly={true}
                        />
                    )}
                    {activeTab === 'proof-of-work' && (
                        <ProofOfWorkTab
                            campaign={campaign}
                            submissions={proofs}
                            isReadOnly={true}
                        />
                    )}
                    {activeTab === 'analytics' && (
                        <AnalyticsTab
                            key={campaign.id}
                            campaign={campaign}
                            influencers={applications}
                            isReadOnly={true}
                            publicProofs={proofs}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
