# Module: Discover

> Influencer search and profile viewing for brands.

## Files

| File | Purpose |
|------|---------|
| `DiscoverPage.tsx` | Search grid with filters |
| `InfluencerProfilePage.tsx` | Full influencer profile |
| `components/ConnectModal.tsx` | Campaign invitation dialog |

## Routes

| Path | Component |
|------|-----------|
| `/discover` | DiscoverPage |
| `/discover/:id` | InfluencerProfilePage |

## Mock Data Used

- `MOCK_INFLUENCERS` — 30+ influencer profiles

## Influencer Object Structure

```typescript
{
  id: string
  name: string
  handle: string          // @username
  bio: string
  avatar: string
  tier: CreatorTier       // nano | micro | mid | macro | mega
  niche: string[]         // ['Beauty', 'Lifestyle']
  platforms: Platform[]   // ['instagram', 'youtube']
  location: string
  languages: string[]
  demographics: {
    ageRange: string      // '18-24'
    genderSplit: { male: number, female: number }
  }
  accounts: {
    platform: string
    handle: string
    followers: number
    engagementRate: number
  }[]
  pastCollaborations: number
  isVerified: boolean
}
```

## Tier Benchmarks

| Tier | Followers |
|------|----------|
| nano | 1K – 10K |
| micro | 10K – 100K |
| mid | 100K – 500K |
| macro | 500K – 1M |
| mega | 1M+ |

## Filter Combinations

- Search: name, handle, bio (debounced 300ms)
- Niche: single select from category list
- Platform: Instagram | YouTube | Twitter
- Creator tier: nano | micro | mid | macro | mega

## API Endpoints

```typescript
API.discover.search                GET /influencers/search
API.discover.getInfluencer(id)     GET /influencers/:id
API.discover.invite                POST /influencers/invite
API.discover.bulkInvite            POST /influencers/bulk-invite
```
