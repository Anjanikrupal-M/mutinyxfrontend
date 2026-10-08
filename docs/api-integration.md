# API Integration Guide

> How to migrate from mock data to a real backend.
> **Architecture is already designed for this** — components don't need to change.

---

## 1. Integration Strategy

The codebase uses a **mock-first** approach. The migration path is:

```
Current: Component → import MOCK_DATA directly
Future:  Component → custom hook → TanStack Query → Axios → Real API
```

Components should **never** change during migration — only hooks change.

---

## 2. Environment Setup

Set these in `.env`:

```env
VITE_API_BASE_URL=https://api.mutinyx.com/api/v1
VITE_WS_URL=wss://api.mutinyx.com
```

For local development:
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
```

The Axios client in `src/core/http.ts` already reads `VITE_API_BASE_URL`.

---

## 3. Step-by-Step Module Migration

### Step 1: Create hooks directory for the module

```bash
mkdir src/modules/campaigns/hooks
touch src/modules/campaigns/hooks/useCampaigns.ts
touch src/modules/campaigns/hooks/useCampaign.ts
```

### Step 2: Write the query hooks

```typescript
// src/modules/campaigns/hooks/useCampaigns.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '@/core/api';
import http from '@/core/http';
import type { Campaign } from '@/shared/types/campaign';

export function useCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => http.get(API.campaigns.list).then(r => r.data),
  });
}

export function useCampaign(id: string) {
  return useQuery<Campaign>({
    queryKey: ['campaign', id],
    queryFn: () => http.get(API.campaigns.getById(id)).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Campaign>) =>
      http.post(API.campaigns.create, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useLaunchCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      http.post(API.campaigns.launch(id)).then(r => r.data),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}
```

### Step 3: Replace mock usage in components

```typescript
// BEFORE (mock):
import { MOCK_CAMPAIGNS } from '@/mocks/data';
const campaigns = MOCK_CAMPAIGNS;

// AFTER (real API):
import { useCampaigns } from '../hooks/useCampaigns';
const { data: campaigns = [], isLoading, error } = useCampaigns();

// Add loading and error states:
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorState message="Failed to load campaigns" />;
```

---

## 4. All Hooks to Build (Priority Order)

### Priority 1: Core data hooks

```typescript
// campaigns
useCampaigns()                          → GET /campaigns
useCampaign(id)                         → GET /campaigns/:id
useCreateCampaign()                     → POST /campaigns
useUpdateCampaign()                     → PUT /campaigns/:id
useLaunchCampaign()                     → POST /campaigns/:id/launch
useCloseCampaign()                      → POST /campaigns/:id/close

// applications
useCampaignApplications(campaignId)     → GET /campaigns/:id/applications
useApproveApplication()                 → POST /campaigns/:id/applications/:aId/approve
useRejectApplication()                  → POST /campaigns/:id/applications/:aId/reject

// negotiation
useNegotiation(campaignId, influencerId) → GET /campaigns/:id/negotiation/:iId
useAcceptNegotiation()                   → POST .../accept
useCounterNegotiation()                  → POST .../counter

// payment
useInitiatePayment()                    → POST /campaigns/:id/payment
usePaymentStatus(campaignId)            → GET /campaigns/:id/payment/status

// scripts
useCampaignScripts(campaignId)          → GET /campaigns/:id/scripts
useApproveScript()                      → POST .../approve
useRequestRevision()                    → POST .../revise

// submissions
useCampaignSubmissions(campaignId)      → GET /campaigns/:id/submissions
useApproveSubmission()                  → POST .../approve
useRejectSubmission()                   → POST .../reject
```

### Priority 2: Discovery + analytics

```typescript
// discover
useInfluencers(filters)                 → GET /influencers/search
useInfluencer(id)                       → GET /influencers/:id
useInviteInfluencer()                   → POST /influencers/invite

// analytics
useAnalyticsOverview()                  → GET /analytics/overview
useCampaignMetrics(campaignId)          → GET /analytics/campaigns/:id

// notifications
useNotifications()                      → GET /notifications
useMarkNotificationRead()               → POST /notifications/:id/read
useMarkAllNotificationsRead()           → POST /notifications/read-all

// messages
useConversations()                      → GET /messages
useConversation(id)                     → GET /messages/:id
useSendMessage()                        → POST /messages/:id
```

### Priority 3: Profile + auth

```typescript
// profile
useBrandProfile()                       → GET /brand/profile
useUpdateProfile()                      → PUT /brand/profile
useUploadAvatar()                       → POST /brand/profile/avatar

// auth
useLogin()                              → POST /auth/login
useLogout()                             → POST /auth/logout
useCurrentUser()                        → GET /auth/me
```

---

## 5. QueryClient Configuration

Current config in `src/core/providers.tsx`:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 minutes — data considered fresh
      refetchOnWindowFocus: false,  // don't refetch when tab regains focus
    },
  },
});
```

**Adjustments to consider per use-case:**
```typescript
// For real-time-ish data (notifications, messages):
{ staleTime: 30 * 1000 }  // 30 seconds

// For static reference data (influencer profiles):
{ staleTime: 30 * 60 * 1000 }  // 30 minutes

// For frequently mutated data (campaign applications):
{ staleTime: 0 }  // always refetch
```

---

## 6. WebSocket Integration

The WebSocket manager at `src/core/websocket.ts` is ready. Connect it after auth:

```typescript
// In AppShell.tsx — connect on mount
import wsManager from '@/core/websocket';
import { useAuthStore } from '@/shared/stores/authStore';

function AppShell() {
  const token = useAuthStore(s => s.token);

  useEffect(() => {
    if (token) {
      wsManager.connect(token);
      return () => wsManager.disconnect();
    }
  }, [token]);

  // ...
}
```

**Wire WS events to React Query invalidation:**

```typescript
// In AppShell or a dedicated useEffect hook
useEffect(() => {
  const handleCampaignUpdate = (data: { campaignId: string }) => {
    queryClient.invalidateQueries({ queryKey: ['campaign', data.campaignId] });
  };

  const handleNewNotification = (notification: Notification) => {
    notificationStore.getState().addNotification(notification);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  wsManager.on(WS_EVENTS.CAMPAIGN_UPDATE, handleCampaignUpdate);
  wsManager.on(WS_EVENTS.NOTIFICATION, handleNewNotification);

  return () => {
    wsManager.off(WS_EVENTS.CAMPAIGN_UPDATE, handleCampaignUpdate);
    wsManager.off(WS_EVENTS.NOTIFICATION, handleNewNotification);
  };
}, [queryClient]);
```

---

## 7. Authentication Flow (Real)

When implementing real auth:

### Login

```typescript
// src/modules/auth/hooks/useAuth.ts
export function useLogin() {
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      http.post(API.auth.login, credentials).then(r => r.data),
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      useAuthStore.getState().setUser(data.user);
    },
  });
}
```

### Token handling

Already implemented in `src/core/http.ts`:
```typescript
// Request interceptor (already exists)
config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;

// 401 response interceptor (already exists)
// Removes token, redirects to '/'
```

### Protected routes

Wrap routes that require auth:
```typescript
// src/core/router.tsx — add auth guard
{
  path: '/',
  element: <RequireAuth><AppShell /></RequireAuth>,
  children: [ /* ... */ ]
}
```

---

## 8. Error Handling Patterns

```typescript
// Global error handling via React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry 401/403/404
        if ([401, 403, 404].includes(error?.response?.status)) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      onError: (error) => {
        toast.error(error?.response?.data?.message || 'Something went wrong');
      },
    },
  },
});

// Component-level error handling
const { data, isLoading, error } = useCampaigns();
if (error) {
  toast.error('Failed to load campaigns');
}
```

---

## 9. Optimistic Updates

For fast UI without waiting for server:

```typescript
export function useApproveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, appId }: { campaignId: string; appId: string }) =>
      http.post(API.campaigns.applications.approve(campaignId, appId)),
    onMutate: async ({ campaignId, appId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['applications', campaignId] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(['applications', campaignId]);

      // Optimistically update
      queryClient.setQueryData(['applications', campaignId], (old: any[]) =>
        old.map(a => a.id === appId ? { ...a, status: 'accepted' } : a)
      );

      return { previous };
    },
    onError: (_, __, context) => {
      // Rollback on error
      queryClient.setQueryData(['applications', context.campaignId], context.previous);
      toast.error('Failed to approve application');
    },
    onSettled: (_, __, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ['applications', campaignId] });
    },
  });
}
```

---

## 10. Migration Checklist

When the backend is ready:

```
□ Set VITE_API_BASE_URL and VITE_WS_URL in .env
□ Implement useLogin() / useLogout() / useCurrentUser()
□ Add RequireAuth route guard in router.tsx
□ Create hooks for each module (Priority 1 first)
□ Replace MOCK_DATA imports with hooks, one module at a time
□ Add isLoading states to pages
□ Add error boundary or error states
□ Wire WebSocket events in AppShell
□ Test campaign lifecycle end-to-end
□ Remove unused mock data imports
```
