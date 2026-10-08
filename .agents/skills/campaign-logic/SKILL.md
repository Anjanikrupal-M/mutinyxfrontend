---
name: Campaign Logic
description: Domain knowledge about the Mutiny Maker campaign pipeline and status transitions.
---

# Campaign Logic Skill

This skill provides the domain-specific logic required to manage the lifecycle of an influencer marketing campaign in Mutiny Maker.

## Core Lifecycle
- **Draft**: Initial state. Editing allowed.
- **Active**: Publicly visible. Applications open.
- **Negotiating**: Brand has accepted an application but rates are being finalized. **BLOCKS PIPELINE**.
- **Accepted**: Budget agreed. Ready for payment.
- **Script**: Payment 1 (50%) received. Influencer submits scripts for approval.
- **Work**: Script approved. Influencer submits final content for review.
- **Completed**: Content approved. Payment 2 (50%) triggered by admin.
- **Closed/Archive**: Final state.

## Business Rules
1. **Negotiation Lock**: Payment cannot be initiated while any influencer is in the 'negotiating' status.
2. **Payment Phases**: 
   - Phase 1 (50% + 5% platform fee) before script starts.
   - Phase 2 (50%) after work is approved.
3. **Revision Loop**: Any number of revisions can be requested for scripts or content. Each revision increments the version number.

## Key Types
Refer to `src/shared/types/campaign.ts` for:
- `CampaignStatus`
- `InfluencerCampaignStatus`
- `PaymentStatus`
- `CreatorTier`
