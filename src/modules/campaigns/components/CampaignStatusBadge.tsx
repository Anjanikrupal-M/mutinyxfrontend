import { StatusBadge } from '@/shared/components/StatusBadge';
import { CAMPAIGN_PHASE_LABELS, getCampaignPhase, type PhaseCampaign } from '../utils/campaignStatus';

/** The one badge for a campaign's status — every surface uses it so they never disagree. */
export function CampaignStatusBadge({ campaign, className }: { campaign: PhaseCampaign; className?: string }) {
    const phase = getCampaignPhase(campaign);
    return <StatusBadge status={phase} label={CAMPAIGN_PHASE_LABELS[phase]} className={className} />;
}
