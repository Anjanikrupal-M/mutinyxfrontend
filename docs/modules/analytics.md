# Module: Analytics

> Cross-campaign performance tracking and ROI analysis.

## Files

| File | Purpose |
|------|---------|
| `AnalyticsPage.tsx` | Single page with all charts (117 lines) |

## Route

`/analytics`

## Mock Data Used

- `MOCK_ANALYTICS` — overview stats, monthly trends, top campaigns

## Sections

### 1. Overview Stats (4 cards)
- Total Reach
- Total Engagement
- Average ROI %
- Total Spend (₹)

### 2. Monthly Trend Chart
- Recharts `LineChart`
- X axis: month labels
- Y axis: reach / engagement values
- Two lines: reach (primary) + engagement (secondary)

### 3. Campaign Type Breakdown
- Recharts `PieChart` (or bar chart)
- % split across: influencer / ugc / meme / twitter

### 4. Top Performing Campaigns Table
- Columns: Campaign Name, Reach, Engagement Rate, ROI, Spend
- Sorted by ROI descending

## Recharts Usage Pattern

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={monthlyData}>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
    <XAxis dataKey="month" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="reach" stroke="hsl(var(--foreground))" strokeWidth={2} />
  </LineChart>
</ResponsiveContainer>
```

## API Endpoints

```typescript
API.analytics.overview                       GET /analytics/overview
API.analytics.campaignMetrics(campaignId)    GET /analytics/campaigns/:id
API.analytics.contentPerformance             GET /analytics/content
```
