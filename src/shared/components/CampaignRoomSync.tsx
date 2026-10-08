import { useEffect, useRef } from 'react';
import { useCampaigns } from '@/modules/campaigns/hooks/useCampaigns';
import ws from '@/core/websocket';

export function CampaignRoomSync() {
    const { data: campaignsData } = useCampaigns();
    const campaigns = campaignsData?.data ?? [];
    
    // Join rooms for any campaign still in progress, so global WS listeners
    // (in websocketSetup.ts) can catch real-time application/status updates.
    const inProgressCampaigns = campaigns.filter((c) =>
        ['active', 'script', 'work'].includes(String(c.status)),
    );
    const inProgressCampaignIds = inProgressCampaigns
        .map((campaign) => campaign.id)
        .filter(Boolean);

    const joinedCampaignsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const targetIds = new Set(inProgressCampaignIds);
        const prevIds = joinedCampaignsRef.current;

        targetIds.forEach((campaignId) => {
            if (!prevIds.has(campaignId)) {
                ws.joinCampaign(campaignId);
            }
        });

        prevIds.forEach((campaignId) => {
            if (!targetIds.has(campaignId)) {
                ws.leaveCampaign(campaignId);
            }
        });

        joinedCampaignsRef.current = targetIds;

        return () => {
            // Note: intentionally leaving rooms joined on unmount to rely on
            // socket disconnect or next mount diffing, unless we actually want to leave.
            // But if this unmounts, we should leave them to prevent leaks.
            targetIds.forEach((campaignId) => ws.leaveCampaign(campaignId));
            joinedCampaignsRef.current = new Set();
        };
    }, [inProgressCampaignIds.join('|')]);

    return null;
}
