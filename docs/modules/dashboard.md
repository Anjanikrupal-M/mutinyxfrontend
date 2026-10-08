# Module: Dashboard

> North Star page. Shows campaign health at a glance.

## Files

| File | Purpose |
|------|---------|
| `DashboardPage.tsx` | Full dashboard (152 lines, single file) |

## Route

`/dashboard` (also default from `/`)

## Mock Data Used

- `MOCK_CAMPAIGNS` → stat cards + campaign grid
- `MOCK_ACTIVITY_FEED` → activity feed section

## Sections

### 1. Stat Cards (top row)
```
Active Campaigns   | Pending Applications | Content Pending | Total Budget
     [count]       |       [count]        |    [count]      |   [₹ sum]
```
Uses `StatCard` component with `TrendingUp` / `Users` / `FileText` / `DollarSign` icons.

### 2. Active Campaigns Grid
- Shows campaigns with status = 'active'
- Each card: campaign type icon, name, status badge, progress bar
- Progress = `creatorsAccepted / creatorsInvited`
- Click → `/campaigns/:id`

### 3. Recent Activity Feed
- Chronological list from `MOCK_ACTIVITY_FEED`
- 5 activity types: `application`, `approval`, `payment`, `script`, `submission`
- Each item has: icon, message, time, link to campaign tab

### 4. Pending Tasks
- Scripts awaiting approval (links to `?tab=scripts`)
- Submissions awaiting review (links to `?tab=submissions`)
- Applications to process (links to `?tab=applications`)

## Campaign Type Icons

| Type | Icon |
|------|------|
| influencer | 👤 |
| ugc | 🎬 |
| meme | 😄 |
| twitter | 🐦 |

Note: These are emoji currently. Future: replace with Lucide icons for consistency.
