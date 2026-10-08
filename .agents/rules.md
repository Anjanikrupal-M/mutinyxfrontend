# Mutiny Maker AI Agent Rules

## Core Principles
- **Modularity**: Every feature must live in `src/modules/[feature]`.
- **Isolation**: Modules must not import from each other directly. Shared code goes to `src/shared`.
- **Mock-First**: Use `src/mocks/data.ts` for all data until API integration.
- **Accent Only**: Yellow (#fedc03) is for badges and indicators ONLY. Max 3px borders.

## Component Rules
- Use `PageHeader` for all page titles.
- Add `animate-fade-in` to all page root elements.
- Import shadcn components from `@/shared/ui/`.
- Use `max-w-5xl mx-auto` for page layout.

## State Management
- **API Data**: TanStack React Query hooks.
- **Global UI State**: Zustand stores in `src/shared/stores`.
- **Module UI State**: Zustand stores in `src/modules/[feature]/stores`.
- **Forms**: React Hook Form + Zod.

## Import Rules
- Always use `@/` alias for root path.
- Follow import order: React -> Third-party -> Core -> Shared -> Local.

## Naming Conventions
- React Components: PascalCase.
- Hooks: camelCase (prefix with `use`).
- Types/Interfaces: PascalCase.
- API Endpoints: defined in `src/core/api.ts`.
