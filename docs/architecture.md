# MutinyX — Architecture Reference

> **Last validated:** 2026-02
> **For AI agents:** Also read `CLAUDE.md` at the project root for coding rules.

---

## 1. What This App Is

**MutinyX** is a B2B SaaS platform for brand owners to:
- Create and manage influencer marketing campaigns
- Discover and invite influencers by niche, platform, and tier
- Negotiate rates, manage contracts (MOU), and handle payments
- Review scripts and submitted content
- Track analytics and ROI

**Who uses it:** Brand owners / marketing managers (one role: `brand_owner`).

**Current state:** Full frontend with mock data. No real backend connected. Real-time infrastructure (WebSocket) and API registry are pre-built and ready for integration.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                   │
│                                                         │
│  ┌───────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │  core/    │  │  shared/   │  │    modules/        │  │
│  │           │  │            │  │                    │  │
│  │ api.ts    │  │ types/     │  │ dashboard/         │  │
│  │ http.ts   │  │ stores/    │  │ campaigns/         │  │
│  │ ws.ts     │  │ components/│  │ discover/          │  │
│  │ router.tsx│  │ ui/        │  │ analytics/         │  │
│  │ providers │  │ hooks/     │  │ profile/           │  │
│  └───────────┘  └────────────┘  │ messages/          │  │
│                                 │ notifications/     │  │
│                                 │ settings/          │  │
│                                 └────────────────────┘  │
└─────────────────────────────────────────────────────────┘
          │ REST (Axios)           │ WebSocket (Socket.io)
          ▼                       ▼
   ┌─────────────┐        ┌──────────────┐
   │  REST API   │        │  WS Server   │
   │ /api/v1/... │        │  ws://...    │
   └─────────────┘        └──────────────┘
         (not yet connected — all data is mock)
```

---

## 3. Directory Structure (Annotated)

```
src/
├── core/                     # App-wide singletons — max 5 files, never add feature code here
│   ├── api.ts                # Single source of truth for ALL API endpoints + WS events
│   ├── http.ts               # Axios instance with auth interceptors (15s timeout)
│   ├── websocket.ts          # Socket.io singleton with auto-reconnect
│   ├── router.tsx            # React Router v6 — all routes with AppShell wrapping
│   └── providers.tsx         # QueryClient (5min stale) + TooltipProvider + Toaster
│
├── shared/                   # Cross-module reusable code
│   ├── ui/                   # shadcn/ui components (50+) — never modify internals
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── components/           # App-level layout and utility components
│   │   ├── AppShell.tsx      # Main layout: Sidebar + Topbar + content Outlet
│   │   ├── Sidebar.tsx       # Collapsible nav (240px ↔ 68px)
│   │   ├── Topbar.tsx        # Search + notifications + user menu
│   │   ├── PageHeader.tsx    # Consistent page title/description/actions
│   │   ├── StatusBadge.tsx   # Color-coded status indicators (24+ statuses)
│   │   └── StatCard.tsx      # Metric card with icon + value + trend
│   ├── types/
│   │   └── campaign.ts       # ALL shared TypeScript types — check here before creating new types
│   ├── stores/               # Global Zustand stores
│   │   ├── authStore.ts      # User session (mock auth today, JWT-ready)
│   │   ├── notificationStore.ts  # In-app notification bell state
│   │   └── sidebarStore.ts   # Sidebar collapsed/expanded state
│   └── hooks/
│       ├── useDebounce.ts    # Generic debounce (default 300ms)
│       ├── useMediaQuery.ts  # CSS media query hook
│       └── useMobile.ts      # Shorthand for max-width: 768px
│
├── modules/                  # Feature modules — strictly isolated from each other
│   ├── dashboard/
│   │   └── DashboardPage.tsx # Overview stats + activity feed + pending tasks
│   ├── campaigns/
│   │   ├── pages/
│   │   │   ├── CampaignListPage.tsx    # Filterable campaign grid
│   │   │   ├── CampaignDetailPage.tsx  # Campaign pipeline (tabs)
│   │   │   └── CampaignBuilderPage.tsx # 4-step campaign creation wizard
│   │   └── components/
│   │       ├── AIStrategistChat.tsx    # AI-powered strategy assistant
│   │       ├── ApplicationsTab.tsx    # Applications + Smart Select + negotiation
│   │       ├── KanbanBoard.tsx        # Status pipeline board
│   │       ├── ScriptsTab.tsx         # Script submission + approval
│   │       ├── SubmissionsTab.tsx     # Work submission + review
│   │       ├── InfluencerQuickView.tsx # Influencer preview modal
│   │       ├── MOUTemplate.tsx        # Contract template display
│   │       └── PaymentConfirmation.tsx # Payment flow UI
│   ├── discover/
│   │   ├── DiscoverPage.tsx           # Influencer search + grid
│   │   ├── InfluencerProfilePage.tsx  # Full influencer profile
│   │   └── components/ConnectModal.tsx # Invitation workflow
│   ├── analytics/
│   │   └── AnalyticsPage.tsx          # Reach, engagement, ROI, top campaigns
│   ├── profile/
│   │   └── ProfilePage.tsx            # Brand profile editor
│   ├── messages/
│   │   └── MessagesPage.tsx           # 3-column chat (conversations + messages)
│   ├── notifications/
│   │   └── NotificationsPage.tsx      # Notification center
│   └── settings/
│       └── SettingsPage.tsx           # Account, security, notifications, billing tabs
│
├── mocks/
│   └── data.ts                        # 79KB — ALL mock data for the entire app
│
├── lib/
│   └── utils.ts                       # cn() — Tailwind class merging utility
│
├── test/
│   └── setup.ts                       # Vitest setup (matchMedia mock)
│
├── App.tsx                            # Root — RouterProvider only
├── main.tsx                           # Entry point — renders App
└── index.css                          # Global styles + CSS design tokens
```

---

## 4. Architectural Decisions & Rationale

### ADR-001: Feature-Based Modular Architecture
**Decision:** Code is organized by feature module, not by type (no top-level `components/`, `hooks/`, `pages/` folders).
**Why:** Modules can be reasoned about, tested, and modified in isolation. Cross-module dependencies are explicit — anything used by 2+ modules lives in `shared/`.
**Constraint:** Modules never import from each other directly. Data shared across modules goes through `shared/`.

### ADR-002: TanStack React Query for Server State
**Decision:** All API data uses TanStack Query's `useQuery` / `useMutation` pattern.
**Why:** Provides caching, background refetch, loading/error states, and optimistic updates out of the box. QueryClient configured with 5-minute staleTime and no window-focus refetch (dashboard app pattern).
**Migration path:** Current mock data returns are shaped to match the hook API `{ data, isLoading, error }` so swapping to real queries requires zero component changes.

### ADR-003: Zustand for Client State (NOT Redux)
**Decision:** Zustand for global and module-scoped client state.
**Why:** Simple, minimal boilerplate, no Provider wrapping needed, TypeScript-first.
**Where:** Global state (auth, notifications, sidebar) in `shared/stores/`. Module UI state in `modules/[x]/stores/`.
**Constraint:** Zustand is ONLY for client state that doesn't come from an API. Server data → React Query. Form data → React Hook Form.

### ADR-004: shadcn/ui (NOT a component library)
**Decision:** shadcn/ui components are copied into `src/shared/ui/` and owned by the project.
**Why:** Full control over component internals, no breaking changes from upstream, can customize freely.
**Constraint:** Components in `shared/ui/` should not be modified manually — if you need a variant, extend via `className` prop or create a wrapper component in `shared/components/`.

### ADR-005: Axios with Centralized Interceptors
**Decision:** Single Axios instance in `core/http.ts` with request/response interceptors.
**Why:** Auth token injection and 401 handling are guaranteed for all requests without per-call boilerplate.
**Token storage:** `localStorage.getItem('token')` — injected in request interceptor.
**Error handling:** 401 → removes token, redirects to `/` (login).

### ADR-006: React Hook Form + Zod (NOT uncontrolled or Formik)
**Decision:** All forms use React Hook Form with Zod resolver.
**Why:** Performant (uncontrolled internally), type-safe schemas with Zod, good shadcn/ui integration.
**Pattern:** Zod schema → infer type → useForm with zodResolver.

### ADR-007: Mock-First Development
**Decision:** All data is mocked in `src/mocks/data.ts` during frontend development.
**Why:** Enables full UI development without a backend. Rich 79KB mock dataset across all features.
**Migration:** When real API is ready, replace mock imports with TanStack Query hooks. Component code stays unchanged.

### ADR-008: Vite + React SWC
**Decision:** Vite with @vitejs/plugin-react-swc (not Babel).
**Why:** Faster HMR and builds via Rust-based SWC transpiler.
**Dev server:** Port 8080 on `::` (IPv6).

### ADR-009: TypeScript Strict Mode OFF
**Decision:** TypeScript strict mode is disabled in `tsconfig.app.json`.
**Why:** Faster initial development velocity. Type safety is enforced through explicit typing of interfaces, not strict null checks.
**Note:** When adding new code, still type explicitly — just don't rely on strict mode to catch everything.

---

## 5. Data Flow

```
User Action
    │
    ▼
React Component (event handler)
    │
    ├── Local UI State? → useState (modal open, tab selection)
    │
    ├── Form data? → React Hook Form
    │
    ├── Global state? → Zustand store action
    │
    └── API call? → TanStack useMutation
            │
            ▼
         http.ts (Axios)
            │ injects auth token
            ▼
         REST API endpoint
            │ response
            ▼
         Cached in QueryClient
            │
            ▼
         Component re-renders via useQuery
```

**Real-time data flow:**
```
WS Server → Socket.io event
    │
    ▼
websocket.ts (event listeners)
    │
    ├── Notification event → notificationStore.addNotification()
    │
    └── Campaign/chat event → QueryClient.invalidateQueries([key])
```

---

## 6. Campaign Pipeline — Technical Mapping

```
CampaignStatus    UI Location          Primary Component
─────────────     ─────────────        ─────────────────────
'draft'           Campaign list        CampaignListPage (badge)
'active'          Campaign detail      CampaignDetailPage
  └─ applications open                 ApplicationsTab
  └─ influencer status: 'applied'      ApplicationsTab
  └─ brand accepts                     ApplicationsTab (Accept button)
  └─ influencer status: 'negotiating'  ApplicationsTab (Negotiation row)
  └─ negotiation resolves              ApplicationsTab (Accept/Counter)
  └─ payment initiated                 PaymentConfirmation
'script'          Campaign detail      ScriptsTab
  └─ script submitted                  ScriptsTab (review card)
  └─ script approved/rejected          ScriptsTab (action buttons)
'work'            Campaign detail      SubmissionsTab
  └─ content submitted                 SubmissionsTab (review card)
  └─ content approved                  SubmissionsTab (approve button)
'completed'       Campaign detail      CampaignDetailPage (closed banner)
```

---

## 7. State Management Map

| Data | Store/Mechanism | Location |
|------|----------------|---------|
| Auth user session | Zustand `authStore` | `shared/stores/authStore.ts` |
| Notification list + unread count | Zustand `notificationStore` | `shared/stores/notificationStore.ts` |
| Sidebar collapsed state | Zustand `sidebarStore` | `shared/stores/sidebarStore.ts` |
| Campaign list | Mock → TanStack Query | `modules/campaigns/hooks/` (future) |
| Campaign detail | Mock → TanStack Query | `modules/campaigns/hooks/` (future) |
| Influencer list | Mock → TanStack Query | `modules/discover/hooks/` (future) |
| Analytics data | Mock → TanStack Query | `modules/analytics/hooks/` (future) |
| Messages/conversations | Mock → TanStack Query | `modules/messages/hooks/` (future) |
| Form state (campaign builder) | React Hook Form | `CampaignBuilderPage.tsx` |
| Form state (profile) | React Hook Form | `ProfilePage.tsx` |
| Search query (debounced) | useState + useDebounce | Component-local |
| Tab/filter state | useState | Component-local |
| Modal open/close | useState | Component-local |

---

## 8. WebSocket Events

All events defined in `src/core/api.ts` under `WS_EVENTS`. Manager at `src/core/websocket.ts`.

| Event | Direction | Trigger | Handler Action |
|-------|-----------|---------|---------------|
| `notification:new` | S → C | Any notable action | `notificationStore.addNotification()` |
| `campaign:update` | S → C | Status change | `queryClient.invalidateQueries(['campaign', id])` |
| `chat:message` | S → C | New message in campaign | Append to conversation |
| `application:received` | S → C | Influencer applies | Update application count |
| `script:submitted` | S → C | Script uploaded | Update ScriptsTab |
| `work:submitted` | S → C | Content uploaded | Update SubmissionsTab |
| `negotiation:update` | S → C | Counter-offer made | Update negotiation state |
| `payment:status` | S → C | Payment processed | Update PaymentStatus |
| `campaign:join` | C → S | User opens campaign detail | Server subscribes to campaign events |
| `campaign:leave` | C → S | User leaves campaign detail | Server unsubscribes |
| `chat:send` | C → S | User sends message | Server broadcasts to all in campaign |
| `notification:read` | C → S | User marks notification read | Server syncs state |

---

## 9. Design System

### Color Tokens (CSS Variables in `index.css`)

```css
/* Core palette */
--background: 0 0% 98%;        /* #fafafa — page backgrounds */
--foreground: 0 0% 4%;         /* #0a0a0a — text/buttons */
--card: 0 0% 100%;             /* white — card surfaces */
--border: 0 0% 90%;            /* light gray — dividers */
--muted-foreground: 0 0% 45%;  /* gray — secondary text */
--primary: 50 99% 50%;         /* #fedc03 — accent ONLY */
```

### Typography Scale

| Class | Font | Weight | Use |
|-------|------|--------|-----|
| `font-display` | Plus Jakarta Sans | 600-800 | Page titles, hero text |
| `font-sans` | Inter | 400-600 | Body, labels, inputs |

### Component Variants

```
Cards:          bg-card border border-border rounded-xl p-5
Primary Button: bg-foreground text-background hover:bg-foreground/90
Secondary Btn:  border border-border hover:bg-muted
Status Badge:   Colored pill via StatusBadge component
Stat Card:      StatCard component with icon, label, value, trend
Tab indicator:  border-b-2 border-primary (yellow) when active
Progress bar:   bg-primary fill (yellow)
Active nav:     border-l-[3px] border-primary (yellow)
```

---

## 10. Environment Configuration

```env
# .env (root level)
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
```

- `VITE_API_BASE_URL` → used in `src/core/api.ts` and `src/core/http.ts`
- `VITE_WS_URL` → used in `src/core/websocket.ts`
- All `VITE_` prefixed vars are inlined at build time by Vite

---

## 11. Build & Scripts

```bash
bun dev          # Dev server at localhost:8080
bun build        # Production build to dist/
bun build:dev    # Dev mode build (no minification)
bun lint         # ESLint check
bun preview      # Preview production build locally
bun test         # Run tests once (Vitest)
bun test:watch   # Watch mode
```

---

## 12. Key Dependencies Reference

```json
"react": "18.3",
"react-router-dom": "6.30",
"@tanstack/react-query": "5.83",
"zustand": "5.0",
"react-hook-form": "7.61",
"zod": "3.25",
"axios": "1.13",
"socket.io-client": "4.8",
"recharts": "2.15",
"framer-motion": "^11",
"lucide-react": "^0.4",
"sonner": "^1" (toast notifications)
```
