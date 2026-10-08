# User Flows & Data Flows — MutinyX

> Complete map of every user journey and how data moves through the system.

---

## 1. Campaign Lifecycle Flow (Master Flow)

This is the most critical flow in the product. Every feature in the app serves this pipeline.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CAMPAIGN LIFECYCLE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CREATION                                                                │
│     Brand → Campaign Builder (4 steps) → Save as Draft                     │
│                         ↓                                                   │
│                    Launch Campaign → status: 'active'                       │
│                                                                              │
│  2. DISCOVERY & APPLICATIONS                                                │
│     • Brand invites influencers via Discover page                           │
│     • Influencers see listing and apply                                     │
│     • ApplicationsTab shows applicants with tier/rate                      │
│                         ↓                                                   │
│                    Brand reviews → Accept / Reject                          │
│                                                                              │
│  3. NEGOTIATION (BLOCKS pipeline)                                           │
│     • Accepted influencer → status: 'negotiating'                          │
│     • Brand sees current rate vs tier rate                                  │
│     • Brand: Accept Rate | Counter Offer                                    │
│     • Influencer: Accept Counter | Decline                                  │
│     • Loop until agreed or withdrawn                                        │
│                         ↓                                                   │
│                    Agreed budget set → status: 'accepted'                   │
│                                                                              │
│  4. PAYMENT (2-Phase)                                                       │
│     • Phase 1: Brand pays 50% upfront → PaymentStatus: 'first_paid'       │
│     • Influencer receives confirmation to proceed                           │
│                         ↓                                                   │
│                    Campaign status → 'script'                               │
│                                                                              │
│  5. SCRIPT PHASE                                                            │
│     • Influencer submits script (PDF/doc) via ScriptsTab                   │
│     • Brand reviews: Approve | Request Revision                             │
│     • Multiple revisions possible                                           │
│     • On approval: status moves to 'work' phase                            │
│                                                                              │
│  6. WORK SUBMISSION                                                         │
│     • Influencer posts content and submits proof via SubmissionsTab        │
│     • Brand reviews content + proof of work                                 │
│     • Brand: Approve | Reject                                               │
│                         ↓                                                   │
│                    All influencers complete → status: 'completed'           │
│                                                                              │
│  7. FINAL PAYOUT                                                            │
│     • Admin releases 50% final payment                                      │
│     • PaymentStatus: 'final_paid'                                           │
│     • Campaign archived                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Campaign Creation Flow (4-Step Builder)

**Route:** `/campaigns/create` → `CampaignBuilderPage.tsx`

```
Step 1: Basics
├── Campaign Name
├── Campaign Type: influencer | ugc | meme | twitter
├── Visibility: public | private
├── Objective (free text)
└── Niche tags (multi-select: Beauty, Food, Tech, Finance, etc.)

       ↓ "Next"

Step 2: Deliverables
├── Platforms: Instagram | YouTube | Twitter (multi-select)
├── Content Formats: Reel | Story | Post | Video | Thread (multi-select)
├── Content Guidelines (text area)
├── Face Required: yes/no
├── Voice Required: yes/no
├── Shoot Type: indoor | outdoor | studio
└── Usage Rights: brand_only | broad | unlimited

       ↓ "Next"

Step 3: Budget
├── Budget Mode: paid | product | paid_product
├── Creator tier pricing (per tier: nano/micro/mid/macro/mega)
│   └── Each tier: rate input field
├── Campaign location/region
├── Timeline: start date + deadline
└── Language requirements

       ↓ "Next"

Step 4: Preview
├── Summary of all campaign details
├── Edit buttons for each section
└── "Launch Campaign" → creates campaign with status 'active'
    OR "Save Draft" → status 'draft'
```

**Data type:** `Campaign` in `shared/types/campaign.ts`

---

## 3. Influencer Discovery & Invitation Flow

**Route:** `/discover` → `DiscoverPage.tsx`
**Detailed view:** `/discover/:id` → `InfluencerProfilePage.tsx`

```
Brand opens Discover
│
├── Search by name/handle/bio (debounced 300ms)
├── Filter by: Niche category
├── Filter by: Platform (Instagram/YouTube/Twitter)
├── Filter by: Creator tier (nano→mega)
│
├── Click influencer card → InfluencerProfilePage
│   ├── Platform accounts + follower counts
│   ├── Demographics (age, gender, location, language)
│   ├── Engagement rate + past collaborations
│   └── "Connect" button → ConnectModal
│       ├── Select campaign to invite for
│       ├── Select content type
│       └── Send invitation
│
└── Smart Select (in ApplicationsTab)
    ├── AI selects best influencers within budget
    ├── Shows selected set with total cost
    └── Brand can accept selection or adjust
```

---

## 4. Applications Review Flow

**Route:** `/campaigns/:id?tab=applications` → `ApplicationsTab.tsx`

```
Applications Tab
│
├── Pending Applications list
│   ├── Influencer card: avatar, name, tier, followers, engagement
│   ├── Applied rate shown vs tier benchmark
│   └── Actions: View Profile | Accept | Reject
│
├── Accepted Influencers list
│   ├── Status: negotiating | accepted
│   ├── If negotiating: show negotiation thread
│   │   ├── Brand's offer history
│   │   ├── Influencer's counter-offers
│   │   └── Actions: Accept Rate | Counter Offer (opens dialog)
│   └── If accepted: proceed to payment
│
└── Rejected list (collapsed, viewable)
```

**Negotiation counter offer dialog:**
```
Brand clicks "Counter Offer"
→ Dialog opens
→ Current rate shown
→ Brand enters counter amount
→ Submit → adds NegotiationEntry to CampaignInfluencer.negotiations[]
→ Status remains 'negotiating' until influencer responds
```

---

## 5. Payment Flow

**Component:** `PaymentConfirmation.tsx`

```
Brand clicks "Initiate Payment" (after negotiation accepted)
│
├── Payment Confirmation dialog
│   ├── Shows: influencer name, agreed budget
│   ├── Phase 1: 50% = ₹[calculated]
│   ├── Platform fee shown
│   └── "Confirm & Pay" button
│
├── On confirm:
│   ├── PaymentStatus → 'first_paid'
│   ├── Influencer notified
│   └── Campaign pipeline unlocked → ScriptsTab active
│
└── Phase 2 (after work approved):
    ├── Admin-triggered (not brand action)
    ├── Final 50% released
    └── PaymentStatus → 'final_paid'
```

**Payment math:**
```
agreedBudget = final negotiated amount
platformFee = agreedBudget * 0.05 (5%)
firstPayment = (agreedBudget + platformFee) * 0.50
finalPayment = agreedBudget * 0.50
```

---

## 6. Script Review Flow

**Route:** `/campaigns/:id?tab=scripts` → `ScriptsTab.tsx`

```
ScriptsTab
│
├── Groups by influencer
├── Each influencer section:
│   ├── Script submission card (latest version)
│   │   ├── File name + upload date
│   │   ├── Version number (v1, v2, v3...)
│   │   └── Status: pending | approved | revision_requested
│   │
│   └── Actions (if status = pending):
│       ├── "Approve Script" → status → 'approved', move to work phase
│       └── "Request Revision" → status → 'revision_requested'
│           └── Influencer must re-upload new version
│
└── Revision loop:
    ScriptVersion.status = 'revision_requested'
    → Influencer uploads new file
    → New ScriptVersion added (version + 1)
    → Back to pending review
```

---

## 7. Work Submission Review Flow

**Route:** `/campaigns/:id?tab=submissions` → `SubmissionsTab.tsx`

```
SubmissionsTab
│
├── Groups by influencer
├── Each submission:
│   ├── Content type: video | image | thread | reel
│   ├── Content URL (link to live post)
│   ├── Proof of work URL/file
│   └── Status: pending | approved | rejected
│
└── Brand actions:
    ├── "Approve" → PaymentStatus unlocked for final payout
    └── "Reject" → Influencer can re-submit
```

---

## 8. Messages / Chat Flow

**Route:** `/messages` → `MessagesPage.tsx`

```
3-Column Layout:
│
├── Left: Conversation List
│   ├── Grouped: Active | Pending | Archived
│   ├── Each item: influencer name, campaign name, last message preview
│   └── Unread badge (yellow)
│
├── Center: Active Conversation
│   ├── Messages timeline (brand vs influencer bubbles)
│   ├── Campaign context bar at top
│   └── Input area (disabled for pending/archived)
│
└── Context: Only messages within campaign scope
    ├── Active conversations → full read/write
    ├── Pending → locked (campaign not accepted yet)
    └── Archived → read-only
```

**WS Events used:**
- `chat:message` (inbound) → append to conversation
- `chat:send` (outbound) → send new message
- `campaign:join` → subscribe on conversation open
- `campaign:leave` → unsubscribe on conversation close

---

## 9. Notification Flow

**Bell icon** (Topbar) → unread badge count

**Types and what triggers them:**

| Type | Trigger | Action |
|------|---------|--------|
| `application` | Influencer applies to campaign | Links to Applications tab |
| `script` | Influencer submits script | Links to Scripts tab |
| `submission` | Influencer submits work | Links to Submissions tab |
| `negotiation` | Counter-offer received | Links to Applications tab |
| `payment` | Payment processed | Links to campaign |
| `chat` | New message received | Links to Messages |
| `system` | Platform announcements | No link |

**Flow:**
```
WS event: notification:new
→ notificationStore.addNotification()
→ unreadCount++ (Topbar bell badge updates)
→ User clicks bell → /notifications
→ Mark individual or all as read
→ WS emit: notification:read
→ unreadCount decreases
```

---

## 10. Dashboard Overview Flow

**Route:** `/dashboard` → `DashboardPage.tsx`

```
Dashboard shows:
│
├── 4 Stat Cards (from MOCK_ANALYTICS / future: API)
│   ├── Active Campaigns (count)
│   ├── Pending Applications (count)
│   ├── Content Pending Review (count)
│   └── Total Budget Deployed (₹ sum)
│
├── Active Campaigns Grid
│   ├── Campaign card: name, type, status badge
│   ├── Progress bar (creators accepted / total invited)
│   └── Click → Campaign Detail
│
├── Recent Activity Feed
│   ├── Chronological list of events
│   ├── Types: application, approval, payment, script, submission
│   └── Each item links to relevant campaign tab
│
└── Pending Tasks
    ├── Scripts to review
    ├── Submissions to review
    └── Applications to process
```

---

## 11. Analytics Flow

**Route:** `/analytics` → `AnalyticsPage.tsx`

```
Analytics shows aggregate data across all campaigns:
│
├── Overview Stats
│   ├── Total Reach (sum of all campaign reach)
│   ├── Total Engagement
│   ├── Average ROI %
│   └── Total Spend
│
├── Monthly Trend Chart (Recharts LineChart)
│   ├── Reach over time
│   └── Engagement over time
│
├── Campaign Type Breakdown (PieChart)
│   ├── % influencer campaigns
│   ├── % UGC campaigns
│   └── % meme/twitter campaigns
│
└── Top Performing Campaigns Table
    ├── Campaign name, reach, engagement, ROI
    └── Sorted by performance
```

---

## 12. Authentication Flow

**Current state:** Mock auth with hardcoded user.
**Future state:** JWT with refresh tokens.

```
Current (Mock):
App loads → authStore has pre-set mock user
→ No login required

Future (Real):
App loads → check localStorage for 'token'
→ If found: http.ts interceptor attaches to all requests
→ 401 response → remove token → redirect to '/'
→ Login page → POST /auth/login → store token → redirect to /dashboard
→ Refresh: POST /auth/refresh → update stored token
```

**Auth state:** `shared/stores/authStore.ts`
```typescript
User {
  id: string
  email: string
  name: string
  brandName: string
  avatar: string | null
  role: 'brand_owner'
}
```

---

## 13. Data Dependency Map

Which mock datasets feed which UI:

```
src/mocks/data.ts
│
├── MOCK_CAMPAIGNS
│   ├── → DashboardPage (stat cards, campaign grid)
│   ├── → CampaignListPage (filterable grid)
│   └── → CampaignDetailPage (campaign detail + overview tab)
│
├── MOCK_CAMPAIGN_INFLUENCERS
│   ├── → ApplicationsTab (applications + negotiation)
│   ├── → ScriptsTab (script versions per influencer)
│   ├── → SubmissionsTab (work submissions per influencer)
│   └── → PaymentConfirmation (payment data)
│
├── MOCK_INFLUENCERS
│   ├── → DiscoverPage (search + filter grid)
│   ├── → InfluencerProfilePage (detailed view)
│   └── → InfluencerQuickView (preview modal)
│
├── MOCK_ANALYTICS
│   └── → AnalyticsPage (all charts + stats)
│
├── MOCK_NOTIFICATIONS
│   ├── → NotificationsPage (notification list)
│   └── → Topbar (unread count badge)
│
├── MOCK_MESSAGES
│   └── → MessagesPage (conversation list + messages)
│
└── MOCK_ACTIVITY_FEED
    └── → DashboardPage (activity feed section)
```
