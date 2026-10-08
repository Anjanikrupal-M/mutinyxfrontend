---
name: Code Patterns
description: Technical expertise in the project's state management and component patterns.
---

# Code Patterns Skill

This skill encompasses the technical patterns and best practices used throughout the Mutiny Maker codebase.

## State Management
- **Server State**: Use TanStack React Query (`useQuery`, `useMutation`). Never use Zustand for API data.
- **Global Client State**: Use Zustand (auth, notifications, sidebar).
- **Module UI State**: Use Zustand inside the module folder.
- **Form State**: Use React Hook Form + Zod.
- **URL State**: Use search params (`?tab=...`) for tab navigation and filters.

## Component Architecture
- **Page Wrapper**: Every page root must have `className="max-w-5xl mx-auto animate-fade-in"`.
- **Page Header**: Use `<PageHeader />` from `@/shared/components/`.
- **UI Primitives**: Use components from `@/shared/ui/` (shadcn). DO NOT modify internals.
- **Grid Pattern**: Standard grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.

## Styling
- **Tailwind Only**: No inline styles.
- **Design Tokens**: Use CSS variables like `var(--primary)`, `var(--border)`.
- **Primary Color**: `#fedc03` (Yellow) is for accents and indicators ONLY. Never use as a large background fill.

## Data Fetching
- **Centralized API**: All endpoints must be defined in `src/core/api.ts`.
- **Axios Instance**: Use the configured `http` client from `src/core/http.ts`.
- **Mock Data**: Use `src/mocks/data.ts` as the single source of truth for mock data until API integration.
