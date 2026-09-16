# Farmilky Management Portal — UI/UX Improvement Plan

## Context

The Farmilky Management portal is a 25-page React 19 admin app using custom CSS with CSS variables, Lucide React icons, and a solid component library (~20 reusable UI components). The codebase is already well-structured with mobile-first responsive design. However, there are inconsistencies in design tokens, duplicated CSS patterns across page-specific stylesheets (12,954 lines across 15 files), button/form class proliferation, and opportunities to improve mobile card experiences and visual polish.

**Goal:** Make every screen feel consistent, modern, and production-ready — especially on mobile phones (primary device). Keep all existing functionality intact.

---

## Phase 1: Design Token Refinement
**Files:** `styles/variables.css`

1. **Fix radius scale** — `--radius` (16px) > `--radius-sm` (12px) is backwards. Rename to logical progression: `--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 16px`, `--radius-xl: 24px`. Update all references across every CSS file.
2. **Add component-level tokens** — `--card-padding`, `--card-radius`, `--card-shadow`, `--btn-height`, `--btn-height-sm` to reduce repetition.
3. **Add missing spacing tokens** — `--space-0.5: 0.125rem`, `--space-14: 3.5rem`, `--space-16: 4rem`.

---

## Phase 2: Button System Consolidation
**Files:** `styles/components.css`, all page JSX files

1. **Standardize on canonical classes:** `.btn` + `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.btn-sm`, `.btn-lg`.
2. **Remove duplicate aliases** (`.primary-button`, `.secondary-button`, `.action-btn-primary`, `.mini-button`, etc.) — consolidate into the canonical names.
3. **Standardize sizing:** Default 40px height, `.btn-sm` 32px, `.btn-lg` 48px.
4. **Search-replace** all JSX files to use the canonical class names.

---

## Phase 3: Form System Unification
**Files:** `styles/forms.css`

1. **Merge `.form-group` and `.form-field`** into one canonical pattern (`.form-field`), keeping `.form-group` as an alias.
2. **Standardize label styling** — consistent uppercase eyebrow labels across all forms.
3. **Add `.form-error`** class for validation error messages.
4. **Remove `.input-with-icon` duplicate** — alias to `.input-wrapper`.

---

## Phase 4: Page CSS Deduplication & Extraction
**Files:** All 15 files in `styles/pages/` (12,954 lines total)

Target: reduce by ~30-40% by extracting repeated patterns into shared CSS.

1. **`dashboard.css` (1,240 lines):** Move `.info-card` overrides to a modifier class `.info-card--accent`. Extract `.dash-ops-card` pattern as shared component.
2. **`deliveries.css` (2,009 lines):** Extract delivery card mobile layout into shared `mc-*` system. Extract status-specific card borders into shared StatusTag integration.
3. **`milk-collections.css` (1,854 lines):** Extract shift cards and collection entry rows into shared patterns.
4. **`invoices.css` (1,680 lines):** Extract invoice line-item table styles into shared table patterns.
5. **`customers.css` (1,154 lines):** Deduplicate with existing component patterns in `components.css`.
6. **Extract shared "panel header + view-all link" pattern** used across dashboard, orders, subscriptions pages.

---

## Phase 5: Mobile Card Enhancement
**Files:** `styles/components.css`, list page JSX files

1. **Audit all list pages** — ensure every DataTable uses `renderCard` with the `mc-*` (mobile card) system for consistent mobile experience.
2. **Add `.mc-detail-row`** — a label-value row component for detail pages on mobile.
3. **Add tap affordance** — subtle right-edge indicator on tappable mobile cards.

---

## Phase 6: List Page Standardization
**Files:** All list page JSX files (~12 pages)

Ensure every list page follows this structure:
1. `PageHeader` with title + optional create button
2. Surface wrapper with SearchInput + filter controls + FilterSheet toggle
3. QuickChips for status filtering (where applicable)
4. DataTable with custom `renderCard` using `mc-*` classes
5. Consistent empty/loading/error state handling

**Key pages to audit:** DeliveriesPage, MilkCollectionsPage, ExpensesPage, PaymentsPage, OrdersPage, SubscriptionsPage, CustomersPage, ProductsPage, ComplaintsPage, ReturnsPage.

---

## Phase 7: Detail Page Standardization
**Files:** All detail page JSX files (~7 pages)

Ensure every detail page follows this structure:
1. `PageHeader` with breadcrumbs + title + StatusTag + action buttons
2. Summary panel (hero section or info cards row)
3. Tabbed content area (consistent tab bar implementation)
4. `StickyActionBar` on mobile for primary actions

**Pages:** CustomerDetailPage, OrderDetailPage, SubscriptionDetailPage, InvoiceDetailPage, SupplierDetailPage, ManifestDetailPage, AgentDetailPage.

---

## Phase 8: Visual Polish & Micro-interactions
**Files:** `styles/components.css`, `styles/variables.css`

1. **Active states** — add `:active { transform: scale(0.97) }` to all cards and buttons consistently.
2. **Focus-visible** — extend focus ring coverage to all interactive elements (chips, selects, options).
3. **Page transitions** — subtle fade-in on `.page-content` for route changes.
4. **Table row cursor** — add `.clickable-row` class with `cursor: pointer`.
5. **Skeleton stagger** — add animation-delay stagger for more natural loading appearance.

---

## Critical Files
- `farmilky-management/src/styles/variables.css` (156 lines)
- `farmilky-management/src/styles/components.css` (2,167 lines)
- `farmilky-management/src/styles/forms.css` (1,203 lines)
- `farmilky-management/src/styles/layout.css` (1,418 lines)
- `farmilky-management/src/styles/tables.css` (200 lines)
- `farmilky-management/src/styles/responsive.css` (158 lines)
- `farmilky-management/src/styles/pages/*.css` (15 files, 12,954 lines)
- `farmilky-management/src/components/ui/*.jsx` (~20 components)
- `farmilky-management/src/pages/*.jsx` (~25 pages)

## Verification
1. Run `npm run build` after each phase to ensure no build errors
2. Visually test on mobile viewport (375px) for every modified page
3. Test on tablet (768px) and desktop (1280px)
4. Verify all existing functionality still works (navigation, forms, modals, filters, data tables)
5. Check accessibility: focus rings, touch targets (44px min), screen reader labels
