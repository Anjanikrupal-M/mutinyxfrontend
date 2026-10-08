# Module: Campaigns

> The most complex module. Manages the full campaign lifecycle.

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `pages/CampaignListPage.tsx` | ~195 | Filterable grid of all campaigns |
| `pages/CampaignDetailPage.tsx` | ~349 | Campaign pipeline with tabs |
| `pages/CampaignBuilderPage.tsx` | ~1324 | 4-step campaign creation wizard |
| `components/AIStrategistChat.tsx` | ~533 | AI strategy assistant (sidebar chat) |
| `components/ApplicationsTab.tsx` | ~517 | Applications + negotiation + smart select |
| `components/KanbanBoard.tsx` | ~117 | Status-grouped influencer pipeline board |
| `components/ScriptsTab.tsx` | ~105 | Script submission + approval |
| `components/SubmissionsTab.tsx` | ~142 | Work submission + review |
| `components/InfluencerQuickView.tsx` | ~125 | Influencer preview modal |
| `components/MOUTemplate.tsx` | ~125 | MOU/contract document template |
| `components/PaymentConfirmation.tsx` | ~94 | Payment flow UI |

## Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/campaigns` | CampaignListPage | Browse all campaigns |
| `/campaigns/create` | CampaignBuilderPage | Create new campaign |
| `/campaigns/:id` | CampaignDetailPage | View/manage specific campaign |

## Mock Data Used

- `MOCK_CAMPAIGNS` → list and detail
- `MOCK_CAMPAIGN_INFLUENCERS` → applications, scripts, submissions, payments

## Key Domain Rules

1. **Campaign creation order**: basics → deliverables → budget → preview/launch
2. **Draft vs Active**: Draft = not visible to influencers. Active = open for applications.
3. **Negotiation is mandatory**: Cannot move to payment without accepting a rate
4. **Payment is 2-phase**: 50% upfront (brand-initiated), 50% on completion (admin-released)
5. **Script approval gates work submission**: Work tab only unlocks after script is approved
6. **Campaign Builder is 1324 lines** — it's large by design (single wizard flow). Do NOT split it without user approval.

## CampaignDetailPage Tabs

| Tab | Route | Component | Visible When |
|-----|-------|-----------|-------------|
| Overview | `?tab=overview` | Inline in DetailPage | Always |
| Applications | `?tab=applications` | ApplicationsTab | status = 'active' |
| Kanban | `?tab=kanban` | KanbanBoard | status = 'active'+ |
| Scripts | `?tab=scripts` | ScriptsTab | status = 'script'+ |
| Submissions | `?tab=submissions` | SubmissionsTab | status = 'work'+ |

## Types Used (from shared/types/campaign.ts)

```typescript
Campaign, CampaignType, CampaignStatus, BudgetMode, CreatorTier,
TierPricing, CampaignBudget, CampaignAnalytics, TopPerformer,
CampaignInfluencer, InfluencerOrigin, InfluencerCampaignStatus,
NegotiationEntry, PaymentStatus, ScriptVersion, WorkSubmission
```

## API Endpoints (from core/api.ts)

```typescript
API.campaigns.list         GET /campaigns
API.campaigns.create       POST /campaigns
API.campaigns.getById(id)  GET /campaigns/:id
API.campaigns.update(id)   PUT /campaigns/:id
API.campaigns.delete(id)   DELETE /campaigns/:id
API.campaigns.launch(id)   POST /campaigns/:id/launch
API.campaigns.close(id)    POST /campaigns/:id/close

API.campaigns.applications.list(cId)           GET
API.campaigns.applications.approve(cId, aId)   POST
API.campaigns.applications.reject(cId, aId)    POST

API.campaigns.negotiation.get(cId, iId)        GET
API.campaigns.negotiation.accept(cId, iId)     POST
API.campaigns.negotiation.counter(cId, iId)    POST

API.campaigns.payment.initiate(cId)            POST
API.campaigns.payment.getStatus(cId)           GET

API.campaigns.scripts.list(cId)                GET
API.campaigns.scripts.approve(cId, sId)        POST
API.campaigns.scripts.requestRevision(cId, sId) POST

API.campaigns.submissions.list(cId)            GET
API.campaigns.submissions.approve(cId, subId)  POST
API.campaigns.submissions.reject(cId, subId)   POST
```
