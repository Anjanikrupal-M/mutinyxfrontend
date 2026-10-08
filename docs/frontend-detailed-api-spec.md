# Frontend Detailed API Specification

This guide provides exactly what frontend developers (and AI agents) need to build the UI against the MutinyX Node.js backend. It details the exact JSON payloads, query parameters, and structures expected by the API.

## 1. Global Setup
- **Base URL:** `http://localhost:3000/api/v1`
- **Headers Needed:**
  - `Content-Type: application/json` (for POST/PUT)
  - `Authorization: Bearer <accessToken>` (for protected routes)
- **Response Format:**
  ```json
  {
    "success": true, // or false
    "data": {}, // The actual payload requested
    "meta": { "total": 100, "page": 1, "limit": 10 } // Optional pagination
  }
  ```

---

## 2. Authentication

### Brand Registration
`POST /brand/auth/register`
```json
{
  "email": "brand@example.com",
  "password": "securepassword123",
  "name": "Jane Doe",
  "role": "brand_owner",
  "brandName": "Acme Corp", // Optional
  "industry": "Tech" // Optional
}
```

### Influencer Registration
`POST /influencers/auth/register`
```json
{
  "email": "creator@example.com",
  "password": "securepassword123",
  "name": "John Smith",
  "role": "influencer",
  "handle": "john_creates" // Optional
}
```

### Login (Same for `/brand` and `/influencers`)
`POST /influencers/auth/login`
```json
{
  "email": "creator@example.com",
  "password": "securepassword123"
}
```
**Returns:** `{ "accessToken": "...", "refreshToken": "...", "user": { "id", "role", "name" } }`

---

## 3. Profile Management

### Update Brand Profile
`PUT /brand/profile`
```json
{
  "name": "Jane Owner",
  "brandName": "Acme Corp",
  "website": "https://acme.com",
  "bio": "Building the future of tech."
}
```

### Update Influencer Profile
`PUT /influencers/profile`
```json
{
  "handle": "john_creates",
  "bio": "Tech reviewer & vlogger",
  "location": "New York, NY",
  "niches": ["tech", "lifestyle"],
  "tier": "micro", // nano, micro, mid, macro, mega
  "followerCount": 25000,
  "engagementRate": 4.5,
  "platforms": [
    { "platform": "instagram", "handle": "john_creates", "followers": 15000 },
    { "platform": "youtube", "handle": "JohnCreatesTech", "followers": 10000 }
  ],
  "rateCard": { "instagram_reel": 500, "youtube_video": 1000 }
}
```

---

## 4. Campaign Management

### Create/Update Campaign (Brand Only)
`POST /campaigns` | `PUT /campaigns/:id`
**Note:** The schema recently shifted to support a nested frontend structure. Pass the payload like this:

```json
{
  "name": "Summer Tech Launch",
  "type": "influencer", // influencer, ugc, meme, twitter
  "visibility": "public", // public, private
  "status": "draft", // draft, active
  "objective": "Brand awareness",
  "brief": "Create an unboxing video of our new gadget.",
  "location": "Global",
  "deadline": "2024-08-01T00:00:00.000Z",
  "proofOfWorkReq": true,
  
  "budget": {
    "mode": "paid", // paid, product, paid_product
    "total": 5000,
    "strategy": "fixed",
    "tierPricing": [
        { "tier": "micro", "amount": 500 },
        { "tier": "mid", "amount": 1000 }
    ]
  },
  
  "requirements": {
    "platform": "instagram",
    "contentTypes": ["reel", "story"],
    "brandGuidelines": "Keep it casual and authentic."
  },
  
  "timeline": {
    "applicationDeadline": "2024-07-15T00:00:00.000Z",
    "scriptDeadline": "2024-07-20T00:00:00.000Z",
    "workDeadline": "2024-07-30T00:00:00.000Z"
  }
}
```

### List/Discover Campaigns
`GET /campaigns/discover` (Influencers) | `GET /campaigns` (Brands)
**Query Parameters:**
- `status`: `draft`, `active`, `script`, `work`, `completed`, `closed`
- `type`: `influencer`, `ugc`, `meme`, `twitter`
- `visibility`: `private`, `public`
- `page`: default 1
- `limit`: default 20
- `sort`: `createdAt`, `deadline`, `progress`

Example: `GET /campaigns/discover?status=active&type=ugc&limit=10`

---

## 5. Interactions & Negotiation

### Apply to Campaign (Influencer)
`POST /campaigns/:campaignId/applications`
```json
{
  "note": "I have extensive experience reviewing tech gadgets."
}
```

### Invite Influencer (Brand)
`POST /influencers/invite`
```json
{
  "influencerId": "uuid-here",
  "campaignId": "uuid-here",
  "message": "We love your content! Check out our new campaign."
}
```

### Negotiation: Counter Offer
`POST /campaigns/:campaignId/negotiation/:influencerId/counter`
```json
{
  "amount": 750,
  "note": "I require $750 based on the fast turnaround required."
}
```

### Negotiation: Accept Offer
`POST /campaigns/:campaignId/negotiation/:influencerId/accept`
```json
{
  "amount": 750
}
```

---

## 6. Frontend Code Example (Axios)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  withCredentials: true // Important for cookies/refresh tokens if implemented
});

// Automatically attach header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Example: Create Campaign
async function createCampaign(campaignData) {
  try {
    const response = await api.post('/campaigns', campaignData);
    return response.data.data; // The created campaign object
  } catch (error) {
    console.error("API Error:", error.response?.data?.error?.message);
    throw error;
  }
}
```
