---
description: Scaffolding a new feature module in src/modules/
---

This workflow guides the agent through creating a new, isolated feature module according to the project's architectural rules.

1. **Create the module directory structure**
   - Create `src/modules/[module-name]/`
   - Create subdirectories: `pages/`, `components/`, `hooks/`, `stores/`
   
2. **Initialize the main page**
   - Create `src/modules/[module-name]/pages/[ModuleName]Page.tsx`
   - Use the standard page template (max-w-5xl, animate-fade-in, PageHeader).
   - Ensure it exports a default component.

3. **Register the route**
   - Update `src/core/router.tsx`.
   - Add the new page as a child of `AppShell`.

4. **Add Navigation (if required)**
   - Update `src/shared/components/Sidebar.tsx` if the module needs a sidebar link.

5. **Define types and mocks**
   - If the module requires new data structures, add them to `src/shared/types/campaign.ts`.
   - Add initial mock data to `src/mocks/data.ts`.

6. **Verify visibility**
   - Check if the page is reachable via the new route.
