# CLAUDE.md — MutinyX AI Coding Guide

> **This file is auto-read by Claude Code at every session start.**
> It is the single authoritative source for how AI agents must behave in this codebase.
> Every rule here exists to prevent broken patterns, duplicated code, and architectural drift.

---

## 1. PROJECT OVERVIEW

**MutinyX** is a B2B SaaS dashboard for brands to run influencer marketing campaigns.

**Core user flow:**
Brand creates campaign → influencers apply → brand negotiates → payment → influencer submits script → brand approves → influencer posts content → brand reviews work → campaign closes

**Current state:** Frontend-only with full mock data. Real API integration is the next major milestone.

**Tech Stack (do not change versions without explicit user approval):**
| Tool | Version | Purpose |
|------|---------|---------|
| React | 18.3 | UI framework |
| TypeScript | ~5.5 | Type safety |
| Vite | 5.4 | Build tool (SWC compiler) |
| React Router | 6.30 | Routing |
| TanStack React Query | 5.83 | Server state / data fetching |
| Zustand | 5.0 | Global & module client state |
| React Hook Form + Zod | 7.61 + 3.25 | Forms + validation |
| shadcn/ui (Radix UI) | latest | UI component primitives |
| Tailwind CSS | 3.4 | Styling |
| Recharts | 2.15 | Data visualization |
| Axios | 1.13 | HTTP client |
| Socket.io-client | 4.8 | WebSocket real-time |

---

## 2. ABSOLUTE RULES — NEVER VIOLATE THESE

```
✗ NEVER add new npm packages without asking the user first
✗ NEVER create a new type that already exists in src/shared/types/campaign.ts
✗ NEVER add a new API endpoint outside of src/core/api.ts
✗ NEVER use yellow (#fedc03) as a large background fill — it is accent-only (indicators, badges, 2-3px borders)
✗ NEVER use inline styles — all styling through Tailwind classes or CSS variables
✗ NEVER bypass the AppShell layout for a new route (all routes must be children of AppShell in router.tsx)
✗ NEVER access another module's internals directly — cross-module data goes through shared/
✗ NEVER create a Zustand store for data that belongs in TanStack Query (server data)
✗ NEVER duplicate shared components — check src/shared/components/ before creating a new one
✗ NEVER hardcode colors — use design token CSS variables (--primary, --muted, --border, etc.)
✗ NEVER delete or modify src/mocks/data.ts without user confirmation — it is the single source of mock data
✗ NEVER remove 'animate-fade-in' from page-level components — it provides consistent UX transitions
```

---

## 3. DIRECTORY RULES — WHERE THINGS GO

```
src/
├── core/           → App-wide singletons ONLY (api, http, websocket, router, providers)
│                     Never put feature code here. Never add more than these 5 files.
├── shared/
│   ├── ui/         → shadcn/ui primitives ONLY. Never modify shadcn components.
│   ├── components/ → Reusable app-level components used by 2+ modules
│   ├── types/      → All shared TypeScript interfaces/types
│   ├── stores/     → Global Zustand stores (auth, notifications, sidebar)
│   └── hooks/      → Reusable hooks used by 2+ modules (useDebounce, useMediaQuery)
├── modules/        → Feature modules (strictly isolated)
│   └── [module]/
│       ├── pages/       → Route-level page components
│       ├── components/  → Module-specific components
│       ├── hooks/       → Module-specific hooks
│       └── stores/      → Module-specific Zustand stores (UI state only)
├── mocks/          → ALL mock data lives here, never inline in components
└── lib/            → Pure utility functions (cn() only today)
```

**Decision tree: where does my new code go?**
- Used by only one module → put it inside that module
- Used by 2+ modules → put it in `shared/`
- Touches routing/HTTP/WebSocket → put it in `core/`
- It's a type → `shared/types/campaign.ts`
- It's mock data → `src/mocks/data.ts`

---

## 4. STATE MANAGEMENT DECISION TREE

```
Is the data fetched from an API (or will it be)?
  → YES: Use TanStack React Query (queryKey + queryFn pattern)
  → NO: Continue...

Is the state shared across multiple components/routes?
  → YES: Use Zustand store in shared/stores/ (if global) or modules/[x]/stores/ (if module-scoped)
  → NO: Continue...

Is it form data with validation?
  → YES: Use React Hook Form + Zod
  → NO: Use React useState (local UI state)
```

**Example TanStack Query pattern (for real API):**
```typescript
// In modules/campaigns/hooks/useCampaigns.ts
import { useQuery } from '@tanstack/react-query';
import { API } from '@/core/api';
import http from '@/core/http';

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => http.get(API.campaigns.list).then(r => r.data),
  });
}
```

**Current mock pattern (what exists today):**
```typescript
// Until real API: import directly from mocks
import { MOCK_CAMPAIGNS } from '@/mocks/data';
```
When replacing mocks with real API, swap the import for the hook — no component changes needed.

---

## 5. COMPONENT STRUCTURE TEMPLATE

Every new page component must follow this structure:

```typescript
// src/modules/[module]/pages/MyPage.tsx
import { useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
// Import only from shared/ or this module's own components

export default function MyPage() {
  // 1. Hooks (state, query, router)
  const [localState, setLocalState] = useState();

  // 2. Derived values / handlers

  // 3. JSX
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <PageHeader title="Page Title" description="Optional description" />
      {/* page content */}
    </div>
  );
}
```

**Rules:**
- Page wrapper: `<div className="max-w-5xl mx-auto animate-fade-in">`
- Always use `<PageHeader>` for page titles (never raw `<h1>`)
- Cards: `className="bg-card border border-border rounded-xl p-5"`
- Grid layout: `className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"`

---

## 6. DESIGN SYSTEM — COLORS & TOKENS

**Color palette:**

| Color | Usage | Tailwind Class |
|-------|-------|----------------|
| `#fedc03` (Yellow) | Active indicator, badges, progress bars — **never large fills** | `bg-primary` |
| `#0a0a0a` (Black) | Buttons (primary), headings, key text | `bg-foreground` |
| `#fafafa` (White) | Card surfaces, page backgrounds | `bg-background` |
| Gray scale | Borders, muted text, secondary surfaces | `border-border`, `text-muted-foreground` |

**Typography:**
- Display/headings → `font-display` (Plus Jakarta Sans)
- Body text → `font-sans` (Inter)
- Never hardcode `font-family` in components

**Interactive states:**
- Hover transitions → `transition-premium` (custom Tailwind utility defined in index.css)
- Button loading states → disable + show spinner
- Animations → `animate-fade-in` on mount for pages/cards

**shadcn/ui usage:**
- Always import from `@/shared/ui/[component]` — never from `radix-ui` directly
- Never override shadcn component internals — extend via className prop only

---

## 7. ROUTING — HOW TO ADD A ROUTE

All routes are in `src/core/router.tsx`. ALL routes must be nested under `AppShell`.

**To add a new route:**
1. Create the page component in `src/modules/[module]/pages/MyPage.tsx`
2. Import it in `src/core/router.tsx`
3. Add it inside the AppShell children array
4. Add nav item in `src/shared/components/Sidebar.tsx` if it needs sidebar navigation

**Route pattern:**
```typescript
// In router.tsx — inside AppShell children
{
  path: '/my-feature',
  element: <MyPage />,
},
{
  path: '/my-feature/:id',
  element: <MyDetailPage />,
},
```

**URL parameter conventions:**
- List page → `/feature`
- Detail page → `/feature/:id`
- Create page → `/feature/create`
- Edit page → `/feature/:id/edit`
- Tabs via search params → `/feature/:id?tab=overview`

---

## 8. CAMPAIGN LIFECYCLE (CRITICAL DOMAIN KNOWLEDGE)

The campaign pipeline is the core of the product. Every status change has business logic attached.

```
draft → active → [applications open]
  ↓
  Applications received → brand reviews in ApplicationsTab
  ↓
  Accept application → Status: "negotiating"
  ↓
  Negotiation complete (accept/counter) → Status: "accepted"
  ↓
  Payment initiated (50% upfront) → PaymentStatus: "first_paid"
  ↓
  Script phase → CampaignStatus: "script"
    - Influencer submits script via ScriptsTab
    - Brand approves or requests revision
  ↓
  Work submission → CampaignStatus: "work"
    - Influencer submits content via SubmissionsTab
    - Brand reviews and approves
  ↓
  Campaign close → CampaignStatus: "completed"
  ↓
  Admin releases final 50% payment → PaymentStatus: "final_paid"
```

**Status enums (from shared/types/campaign.ts):**
```typescript
CampaignStatus: 'draft' | 'active' | 'script' | 'work' | 'completed' | 'closed' | 'withdrawn'
InfluencerCampaignStatus: 'invited' | 'applied' | 'accepted' | 'negotiating' | 'rejected' | 'withdrawn' | 'completed'
PaymentStatus: 'pending' | 'first_paid' | 'final_paid' | 'refunded'
```

**IMPORTANT:** Negotiation BLOCKS the pipeline. No payment can be initiated until negotiation is resolved.

---

## 9. TYPE SYSTEM — USE EXISTING TYPES

**Before creating any new type, read `src/shared/types/campaign.ts` first.**

Key existing types:
```typescript
Campaign           // Full campaign object (26+ properties)
CampaignInfluencer // Brand-influencer relationship + full lifecycle data
CampaignType       // 'influencer' | 'ugc' | 'meme' | 'twitter'
CampaignStatus     // All status values (see section 8)
CreatorTier        // 'nano' | 'micro' | 'mid' | 'macro' | 'mega'
BudgetMode         // 'paid' | 'product' | 'paid_product'
TierPricing        // Per-tier rate object
NegotiationEntry   // Single negotiation round
ScriptVersion      // Script submission + approval
WorkSubmission     // Content submission + review
Conversation       // Chat thread
Message            // Individual chat message
Notification       // Notification object
```

**User type is in `src/shared/stores/authStore.ts`:**
```typescript
User { id, email, name, brandName, avatar, role: 'brand_owner' }
```

**When you need a type not in these files:** Add it to `src/shared/types/campaign.ts` and document it.

---

## 10. MOCK DATA — THE SINGLE SOURCE OF TRUTH

All mock data lives in `src/mocks/data.ts` (79KB). This is the ONLY place to define mock data.

**Available collections:**
- `MOCK_CAMPAIGNS` — Campaign objects with analytics + top performers
- `MOCK_CAMPAIGN_INFLUENCERS` — Brand-influencer relationship data
- `MOCK_INFLUENCERS` — 30+ influencer profiles
- `MOCK_NOTIFICATIONS` — Notification objects
- `MOCK_MESSAGES` — Conversation threads
- `MOCK_ACTIVITY_FEED` — Dashboard activity items
- `MOCK_ANALYTICS` — Analytics overview + monthly trends

**To add new mock data:** Add to `src/mocks/data.ts` following existing patterns.
**Never** create a `data.ts` or `mockData.ts` inside a module folder.

---

## 11. IMPORT CONVENTIONS

```typescript
// Path alias: '@' maps to 'src/'
// Always use @/ imports, never relative ../../../

// Correct:
import { Button } from '@/shared/ui/button';
import { PageHeader } from '@/shared/components/PageHeader';
import { Campaign } from '@/shared/types/campaign';
import { API } from '@/core/api';
import http from '@/core/http';
import { MOCK_CAMPAIGNS } from '@/mocks/data';
import { cn } from '@/lib/utils';

// Wrong:
import { Button } from '../../../shared/ui/button';  // ✗ relative
import { Button } from '@radix-ui/react-button';      // ✗ direct Radix
```

**Import order (follow this in every file):**
1. React and React Router imports
2. Third-party library imports
3. Core imports (`@/core/`)
4. Shared imports (`@/shared/`)
5. Module-local imports (`./` or `../`)

---

## 12. HOW TO ADD A NEW MODULE

Follow this checklist:

```
1. Create directory: src/modules/[module-name]/
2. Create subdirectories: pages/, components/, hooks/, stores/
3. Create main page: src/modules/[module-name]/pages/[Module]Page.tsx
4. Add route in: src/core/router.tsx
5. Add sidebar nav item in: src/shared/components/Sidebar.tsx (if needed)
6. Add any shared types to: src/shared/types/campaign.ts
7. Add API endpoints to: src/core/api.ts
8. Add mock data to: src/mocks/data.ts
```

Never skip steps — especially 7 and 8, even if the feature isn't wired up yet. Pre-defining APIs and mock data keeps the codebase consistent.

---

## 13. API INTEGRATION READINESS

The codebase is designed so that swapping mock data for real API calls requires **zero component changes**.

**Pattern to follow when building hooks:**
```typescript
// Today (mock):
export function useCampaigns() {
  return { data: MOCK_CAMPAIGNS, isLoading: false, error: null };
}

// Tomorrow (real API — same interface, same component code):
export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => http.get(API.campaigns.list).then(r => r.data),
  });
}
```

Components should only destructure `{ data, isLoading, error }` — never inline mock data in component files.

**Environment variables needed:**
- `VITE_API_BASE_URL` — REST API base (default: `http://localhost:3000/api/v1`)
- `VITE_WS_URL` — WebSocket server (default: `ws://localhost:3000`)

---

## 14. WEBSOCKET PATTERNS

The WebSocket manager is a singleton at `src/core/websocket.ts`.

```typescript
import wsManager from '@/core/websocket';
import { WS_EVENTS } from '@/core/api';

// Connect (typically in a layout-level useEffect)
wsManager.connect(userToken);

// Subscribe to events
const handler = (data: unknown) => { /* handle */ };
wsManager.on(WS_EVENTS.CHAT_MESSAGE, handler);

// Cleanup
wsManager.off(WS_EVENTS.CHAT_MESSAGE, handler);

// Campaign room management
wsManager.joinCampaign(campaignId);
wsManager.leaveCampaign(campaignId);
```

**Rule:** Always remove event listeners in useEffect cleanup to prevent memory leaks.

---

## 15. FORMS — REACT HOOK FORM + ZOD

All forms use React Hook Form with Zod schema validation.

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/shared/ui/form';

const schema = z.object({
  name: z.string().min(1, 'Required'),
});

type FormData = z.infer<typeof schema>;

function MyForm() {
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </form>
    </Form>
  );
}
```

---

## 16. NOTIFICATIONS — HOW TO TRIGGER TOASTS

Use Sonner toast (not alert, not window.confirm):

```typescript
import { toast } from 'sonner';

toast.success('Campaign launched!');
toast.error('Something went wrong');
toast.info('Saving changes...');
```

For in-app notifications (bell icon), use `notificationStore`:

```typescript
import { useNotificationStore } from '@/shared/stores/notificationStore';

const { addNotification } = useNotificationStore();
addNotification({ type: 'system', title: 'Title', message: 'Message body' });
```

---

## 17. TESTING CONVENTIONS

- Test runner: Vitest + Testing Library
- Test files: co-locate with component — `MyComponent.test.tsx` next to `MyComponent.tsx`
- Run tests: `bun test` or `bun test:watch`

```typescript
// Minimal component test template
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});
```

---

## 18. COMMON PITFALLS (DO NOT REPEAT)

| Pitfall | Prevention |
|---------|------------|
| Duplicating type definitions | Always check `shared/types/campaign.ts` first |
| Inline mock data in components | Use `src/mocks/data.ts` exclusively |
| Adding API endpoint inline | All endpoints go in `src/core/api.ts` |
| Creating new UI primitives | Check `src/shared/ui/` for existing shadcn components |
| Using yellow as a large background | Yellow = accent only (max 3px indicators) |
| Cross-module direct imports | Route data through `shared/` |
| Missing `animate-fade-in` on pages | Add to every page root div |
| Using `find` or `grep` in Bash tool | Use Glob and Grep tools instead |
| Forgetting route in router.tsx | Every page needs a route entry |
| Adding sidebar item without route | Route must exist first |

---

## 19. CODEBASE HEALTH CHECKS

Before submitting any change, verify:

```
□ No new types duplicated from shared/types/campaign.ts
□ No new API endpoints outside src/core/api.ts
□ No new mock data outside src/mocks/data.ts
□ No direct cross-module imports
□ No yellow used as large background fill
□ Page component has animate-fade-in wrapper
□ New route added to src/core/router.tsx
□ New shared component documented in component comment
□ No hardcoded colors (use Tailwind classes/CSS vars)
□ All imports use @/ alias, not relative paths
```

---

## 20. QUICK REFERENCE — FILE LOCATIONS

| What you need | Where it is |
|--------------|------------|
| All API endpoints | `src/core/api.ts` |
| HTTP client (Axios) | `src/core/http.ts` |
| WebSocket manager | `src/core/websocket.ts` |
| All routes | `src/core/router.tsx` |
| All mock data | `src/mocks/data.ts` |
| All shared types | `src/shared/types/campaign.ts` |
| Auth state | `src/shared/stores/authStore.ts` |
| Notification state | `src/shared/stores/notificationStore.ts` |
| Sidebar state | `src/shared/stores/sidebarStore.ts` |
| App layout | `src/shared/components/AppShell.tsx` |
| Sidebar nav | `src/shared/components/Sidebar.tsx` |
| Top bar | `src/shared/components/Topbar.tsx` |
| Design tokens | `src/index.css` |
| Tailwind config | `tailwind.config.ts` |
| Path aliases | `tsconfig.app.json` + `vite.config.ts` |
| shadcn components | `src/shared/ui/` |
| Utility (cn) | `src/lib/utils.ts` |
