---
description: Migrating a mock-data component to a real API hook using TanStack Query
---

This workflow details how to replace direct mock data imports with asynchronous API hooks without breaking the UI.

1. **Verify environment variables**
   - Ensure `VITE_API_BASE_URL` is set in `.env`.

2. **Create the hook**
   - Create (or update) `src/modules/[module]/hooks/use[Entity].ts`.
   - Use `useQuery` or `useMutation` from `@tanstack/react-query`.
   - Reference `API` endpoints from `src/core/api.ts` and use `http` from `src/core/http.ts`.

3. **Update the component**
   - Remove the direct import of `MOCK_DATA`.
   - Import and use the new hook: `const { data, isLoading, error } = use[Entity]();`.
   - Add loading and error boundary/state handling in the JSX.

4. **Wire WebSocket updates (optional)**
   - If real-time updates are needed, add an `useEffect` in the component or layout to listen for WS events and invalidate the relevant query keys.

5. **Test the integration**
   - Verify that the component renders correctly with the data fetched from the (mock or real) API.
