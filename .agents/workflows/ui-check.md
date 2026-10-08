---
description: Validating UI consistency and design system compliance
---

This workflow helps ensure that all new or modified UI elements adhere to the Mutiny Maker design tokens and accessibility standards.

1. **Check Color Tokens**
   - Ensure NO hardcoded hex codes are used (except in `index.css`).
   - Use Tailwind classes: `text-primary`, `bg-card`, `border-border`.
   - **Yellow Check**: Verify that `bg-primary` (yellow) is only used for accents (badges, indicators, progress bars) and NOT for large background fills.

2. **Check Component Primitives**
   - Verify that UI components are imported from `@/shared/ui/` (shadcn).
   - Ensure `PageHeader` is used for all page titles.

3. **Check Animations**
   - Page roots must have `animate-fade-in`.
   - Hoverable items should use `transition-premium`.

4. **Responsive Layout**
   - Test the layout on mobile/tablet viewports (max-width: 768px).
   - Ensure grids use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` pattern.

5. **Accessibility**
   - Buttons must have descriptive labels.
   - Images must have `alt` text.
