---
name: pragmatic-modernism
description: Use this skill for all frontend UI generation to enforce the CRM's design system.
---
# Design Rules
- **Typography:** Strictly use `IBM Plex Sans` for UI and `IBM Plex Mono` for numbers/data.
- **Styling:** Use Tailwind CSS. Enforce 0px border radius and 1px solid `#E2E8F0` borders for depth (no drop shadows).
- **Colors:** Primary actions use `#0F172A` (Navy), accents use `#2563EB` (Blue).
- **Analytics & Charts:** All dashboard charts must use `@cubejs-client/react` for data fetching and `recharts` for visualization. Charts must have 0px border radius, 1px borders, and use IBM Plex Mono for tooltips and axis ticks.

# Analytics & Dashboard Architecture
- **Semantic Layer:** Use `@cubejs-client/react` (`useCubeQuery`) to query analytical metrics, revenue aggregations, aging buckets, and Pareto calculations.
- **Visualization Library:** Use `recharts` for all charts (Bar, Line, Area).
- **Styling Rules for Charts:**
  - Charts must conform to Pragmatic Modernism: monochromatic palettes (`#0F172A`, `#64748B`), accented strictly with Navy `#0F172A`, Slate `#64748B`, and Blue `#2563EB`.
  - Chart containers must have `0px` border radius, `1px solid #E2E8F0` borders, and no drop shadows.
  - Tooltips must be styled with a `#0F172A` background and crisp white monospace text (`IBM Plex Mono`).
  - Axis labels and legends must use `IBM Plex Sans` (11px, uppercase).