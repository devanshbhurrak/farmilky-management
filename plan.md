 Admin Portal Mobile-First Redesign Plan                                                                                                                            
                                                                                                                                                                    
 Context

 The Farmilky admin portal is a React 19 + Vite 8 SPA used daily by admins and delivery staff on mobile devices. The current UI has a sidebar-heavy navigation that 
  wastes horizontal space on mobile (collapses to 68px icon-only strip), tables that use a clunky display:block CSS hack on small screens, a 429-line
 DeliveriesPage with all logic inlined, and no code splitting, error boundaries, or request caching. The redesign aims to make this feel like a modern operational  
 dashboard optimized for one-handed mobile use.

 Tech stack (unchanged): React 19, Vite 8, react-router-dom 7, custom CSS with CSS variables, Lucide React icons, react-hot-toast, Context API.

 ---
 Phase 1: Foundation (no visual changes)

 Goal: Lay groundwork without breaking anything. Performance and resilience improvements.

 1.1 Design system tokens

 File: src/styles/variables.css
 - Add standardized spacing scale: --space-1 (0.25rem) through --space-10 (2.5rem)
 - Add --touch-min: 48px token for minimum touch target
 - Add --bottom-nav-height: 56px and --mobile-header-height: 48px
 - Add breakpoint reference comment block (480/768/1024/1280px)
 - Fix --text-muted contrast: darken from #6b7a70 to #5a6960 (WCAG AA compliance)

 1.2 Responsive utilities

 Create: src/styles/responsive.css
 - .hide-mobile / .hide-desktop visibility toggles at 768px
 - .stack-mobile — column on mobile, row on desktop
 - Import in src/index.css

 1.3 Core hooks

 Create: src/hooks/useMediaQuery.js — returns boolean for viewport queries (e.g., useMediaQuery("(min-width: 768px)"))
 Create: src/hooks/useBodyScrollLock.js — locks body scroll when bottom sheet/drawer is open

 1.4 Error boundary

 Create: src/components/ui/ErrorBoundary.jsx — class component with componentDidCatch, "Something went wrong" fallback with retry button
 Modify: src/App.jsx — wrap route outlet with ErrorBoundary

 1.5 Lazy loading + Suspense

 Create: src/components/ui/PageSkeleton.jsx — full-page skeleton for route transitions
 Modify: src/App.jsx:
 - Replace static page imports with React.lazy()
 - Wrap routes in <Suspense fallback={<PageSkeleton />}>
 - Reduces initial bundle to login page + requested route only

 1.6 Input accessibility

 Modify: src/styles/forms.css — set font-size: 16px on all input, select, textarea to prevent iOS auto-zoom
 Modify: src/index.css — add @media (prefers-reduced-motion: reduce) rule to disable animations
 Modify: src/styles/tables.css — normalize the 760px breakpoint to 768px

 ---
 Phase 2: Navigation Redesign

 Goal: Replace the sidebar-heavy mobile experience with a bottom tab bar + slide-up drawer.

 2.1 Mobile header

 Create: src/components/layout/MobileHeader.jsx
 - Compact 48px sticky top bar: brand name (left) + refresh button + avatar/role badge (right)
 - Visible only below 768px

 2.2 Bottom tab bar

 Create: src/components/layout/BottomNav.jsx
 - Fixed bottom bar (56px + safe-area-inset-bottom)
 - Admin tabs: Dashboard | Deliveries | Orders | More
 - Delivery partner: no bottom nav (only Deliveries route accessible)
 - Active tab uses orange accent (--color-secondary)
 - All tabs are 48px+ touch targets with icon + label

 2.3 "More" drawer

 Create: src/components/layout/MobileDrawer.jsx
 - Slide-up drawer triggered by "More" tab
 - Contains: Subscriptions, Customers, Products, Invoices links
 - Divider, then: user info, Refresh Data button, Logout button
 - Overlay backdrop with click-to-close
 - Uses useBodyScrollLock

 2.4 Layout CSS overhaul

 Modify: src/styles/layout.css
 - Mobile (default): sidebar display: none, topbar display: none, bottom nav visible
 - Add padding-bottom: var(--bottom-nav-height) to page-content on mobile
 - Desktop (min-width: 768px): sidebar visible at 248px, topbar visible, bottom nav hidden, remove collapsed sidebar logic from mobile
 - Convert all max-width media queries to mobile-first min-width

 2.5 Shell integration

 Modify: src/App.jsx
 - Add <BottomNav> and <MobileHeader> to the shell layout
 - Both components self-hide on desktop via CSS

 Result: On mobile, sidebar disappears, bottom nav appears, full-width page content. Desktop is unchanged.

 ---
 Phase 3: Responsive Data Display

 Goal: Replace clunky table-to-block mobile hack with card-based views.

 3.1 DataTable dual-mode

 Modify: src/components/ui/DataTable.jsx
 - Add renderCard prop (function receiving a row, returns JSX)
 - Use useMediaQuery to detect mobile
 - When mobile + renderCard provided: render a <div className="card-list"> with paged.map(renderCard)
 - When desktop or no renderCard: render existing <table>
 - Pagination remains identical in both modes

 3.2 Pagination improvements

 Modify: src/components/ui/Pagination.jsx
 - Ellipsis pattern for many pages (1 ... 4 5 6 ... 20) instead of all page numbers
 - Increase button touch targets on mobile to 48px min-height
 - Simplify mobile view: Prev/Next + "Page X of Y" text only

 3.3 Page migrations (card views)

 Each list page gets a renderCard function passed to DataTable. No new files needed — inline render functions.

 Modify: src/pages/OrdersPage.jsx — card shows: customer name, date, amount, status badge, payment status. Tap navigates to detail.
 Modify: src/pages/SubscriptionsPage.jsx — card shows: customer name, product, schedule, status badge. Tap navigates to detail.
 Modify: src/pages/CustomersPage.jsx — card shows: name, role badge, phone. Tap navigates to detail.
 Modify: src/pages/InvoicesPage.jsx — card shows: customer name, month, total, status, "Record Payment" button.

 3.4 Filter pattern

 Create: src/components/ui/BottomSheet.jsx — reusable bottom sheet (slides up from bottom, 60-80% screen height, overlay backdrop, uses useBodyScrollLock)
 Create: src/components/ui/FilterSheet.jsx — wraps BottomSheet, renders filter controls inside, triggered by a filter icon button on mobile

 On mobile, filter bars collapse into a filter icon button that opens a FilterSheet. Search input stays visible above the data.

 3.5 Dashboard grid fix

 Modify: src/styles/components.css — change .card-grid to grid-template-columns: repeat(2, 1fr) by default, repeat(4, 1fr) at 768px+
 Modify: src/styles/components.css — change .two-column-grid to single-column default, two-column at 768px+

 ---
 Phase 4: Delivery Workflow Redesign

 Goal: Optimize the highest-value page for one-handed mobile use by delivery staff.

 4.1 Decompose DeliveriesPage (429 lines -> ~150 lines)

 Create: src/components/delivery/DeliveryCard.jsx — single delivery stop card with customer info, product, address, action buttons
 Create: src/components/delivery/OutcomeForm.jsx — extract lines 373-429 from DeliveriesPage
 Create: src/components/delivery/BulkActionsBar.jsx — sticky bottom bar (above bottom nav) showing "{N} selected | Deliver All"
 Create: src/components/delivery/DeliveryFilters.jsx — date, status, type filters; renders inline on desktop, inside BottomSheet on mobile

 Modify: src/pages/DeliveriesPage.jsx — refactor to import extracted components, reduce to orchestration logic only

 4.2 Mobile delivery UX improvements

 - DeliveryCard: Full-width cards with large touch targets. "Deliver" button spans full card width (48px+ height). Secondary actions (Skip, Change Qty, Failed) in  
 a row below.
 - Outcome modal -> bottom sheet: On mobile, replace centered Modal with BottomSheet for outcome recording
 - Quick reason chips: Add pre-set tappable reason chips for Skip ("Customer not home", "Requested skip", "Other") and Failed ("Address not found", "Customer       
 refused", "Product damaged", "Other"). Selecting "Other" reveals the textarea. Reduces typing.
 Create: src/components/ui/QuickChips.jsx — row of selectable chips, one active at a time, "Other" reveals custom input
 - Bulk actions: When items selected, show a sticky BulkActionsBar floating above bottom nav with large thumb-reachable "Deliver All" button

 4.3 Summary panel (mobile)

 On mobile, convert the stacked summary cards to a horizontal scrollable strip of 3 compact metric chips (Pending / Completed / Exceptions).

 ---
 Phase 5: Detail Pages + Forms

 Goal: Polish drill-down experience on mobile.

 5.1 Sticky action bar

 Create: src/components/ui/StickyActionBar.jsx — fixed bottom bar on mobile for page-level actions (e.g., Confirm/Deliver/Cancel on order detail)
 - Sits above bottom nav
 - Full-width buttons with 48px+ height

 5.2 Detail page updates

 Modify: src/pages/OrderDetailPage.jsx — action buttons move to StickyActionBar on mobile; single-column stack
 Modify: src/pages/SubscriptionDetailPage.jsx — delivery history renders as card list on mobile; action buttons in StickyActionBar; remove inline grid style        
 overrides
 Modify: src/pages/CustomerDetailPage.jsx — tab bar uses full-width horizontally scrollable pills; sub-tables use renderCard pattern

 5.3 Product form extraction

 Create: src/components/product/ProductForm.jsx — extracted from ProductsPage (lines ~100-263)
 Modify: src/pages/ProductsPage.jsx — import ProductForm; on mobile, render in a full-height BottomSheet instead of centered Modal

 5.4 Dashboard polish

 Modify: src/pages/DashboardPage.jsx:
 - Recent orders/subscriptions: on mobile, remove inline ActionRow (too many small targets), replace with tap-to-navigate links
 - Load sheet + watchlist: stack vertically on mobile (already handled by Phase 3 grid fix)

 ---
 Phase 6: Accessibility + Performance Polish

 6.1 Focus management

 Modify: src/components/ui/Modal.jsx — add focus trap (first/last focusable element loop), Escape key handler, aria-modal="true", role="dialog"
 Apply same patterns to: BottomSheet.jsx, MobileDrawer.jsx

 6.2 ARIA attributes

 - StatusTag.jsx — add aria-label="Status: {value}"
 - BottomNav.jsx — aria-current="page" on active tab
 - Sidebar.jsx — aria-current="page" on active link
 - All interactive components — ensure 48px minimum touch targets via min-height: var(--touch-min) on mobile

 6.3 Data context + caching

 Create: src/context/PortalDataContext.jsx — moves portal data loading from App.jsx into dedicated context with 60-second staleness check
 Modify: src/App.jsx — simplify by removing portal data state/loading, wrap in <PortalDataProvider>
 Modify: src/hooks/useApiData.js — add optional cacheKey param with in-memory Map cache

 6.4 Swipe gesture (optional progressive enhancement)

 Create: src/hooks/useSwipe.js — detect horizontal swipe on touch devices
 Apply to DeliveryCard: swipe right to quick-deliver with undo toast

 ---
 New Files Summary

 src/
 ├── components/
 │   ├── delivery/
 │   │   ├── DeliveryCard.jsx
 │   │   ├── OutcomeForm.jsx
 │   │   ├── BulkActionsBar.jsx
 │   │   └── DeliveryFilters.jsx
 │   ├── layout/
 │   │   ├── BottomNav.jsx
 │   │   ├── MobileHeader.jsx
 │   │   └── MobileDrawer.jsx
 │   ├── product/
 │   │   └── ProductForm.jsx
 │   └── ui/
 │       ├── BottomSheet.jsx
 │       ├── ErrorBoundary.jsx
 │       ├── FilterSheet.jsx
 │       ├── PageSkeleton.jsx
 │       ├── QuickChips.jsx
 │       └── StickyActionBar.jsx
 ├── context/
 │   └── PortalDataContext.jsx
 ├── hooks/
 │   ├── useBodyScrollLock.js
 │   ├── useMediaQuery.js
 │   └── useSwipe.js
 └── styles/
     └── responsive.css

 Total: 19 new files

 Modified Files Summary

 ┌──────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
 │                 File                 │                                Changes                                 │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/App.jsx                          │ Lazy loading, ErrorBoundary, BottomNav/MobileHeader, PortalDataContext │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/styles/variables.css             │ Spacing tokens, touch target, bottom nav height, contrast fix          │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/styles/layout.css                │ Mobile-first rewrite, hide sidebar/topbar on mobile, bottom nav space  │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/styles/components.css            │ Mobile-first grids, card-list class, touch target minimums             │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/styles/tables.css                │ Normalize breakpoint to 768px                                          │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/styles/forms.css                 │ font-size: 16px on inputs                                              │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/index.css                        │ Import responsive.css, prefers-reduced-motion                          │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/components/ui/DataTable.jsx      │ renderCard prop, useMediaQuery for adaptive rendering                  │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/components/ui/Pagination.jsx     │ Ellipsis pattern, mobile touch targets                                 │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/components/ui/Modal.jsx          │ Focus trap, Escape key, ARIA attributes                                │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/components/ui/StatusTag.jsx      │ aria-label                                                             │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/pages/DeliveriesPage.jsx         │ Decompose into extracted components (~429 -> ~150 lines)               │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/pages/OrdersPage.jsx             │ renderCard for mobile, filter bottom sheet                             │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/pages/SubscriptionsPage.jsx      │ renderCard for mobile, filter bottom sheet                             │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/pages/CustomersPage.jsx          │ renderCard for mobile                                                  │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/pages/InvoicesPage.jsx           │ renderCard for mobile                                                  │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/pages/OrderDetailPage.jsx        │ StickyActionBar on mobile                                              │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/pages/SubscriptionDetailPage.jsx │ Card-based history, StickyActionBar, remove inline styles              │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/pages/CustomerDetailPage.jsx     │ Scrollable tab pills, renderCard sub-tables                            │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/pages/ProductsPage.jsx           │ Extract ProductForm, BottomSheet on mobile                             │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/pages/DashboardPage.jsx          │ Mobile-friendly recent activity, grid adjustments                      │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/hooks/useApiData.js              │ Optional cache layer                                                   │
 ├──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 │ src/components/layout/Sidebar.jsx    │ aria-current, display:none on mobile                                   │
 └──────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘

 ---
 Migration Order

 Phase 1 (Foundation) -> Phase 2 (Navigation) -> Phase 3 (Data Display) -> Phase 4 (Delivery Workflow) -> Phase 5 (Detail Pages) -> Phase 6 (Accessibility/Perf)    

 Each phase is independently shippable. Desktop UI remains unchanged throughout until deliberately refined. Mobile experience improves incrementally with each      
 phase.

 ---
 Verification Plan

 Per-phase testing

 1. Visual: Resize browser from 320px to 1440px — no horizontal scroll, no overlapping elements
 2. Navigation: All routes reachable on mobile via bottom nav / drawer; sidebar works on desktop
 3. Tables/Cards: Data renders as cards on mobile, tables on desktop; pagination works in both modes
 4. Delivery flow: Complete a delivery outcome on mobile (deliver, skip with reason, change qty, fail with reason, bulk deliver)
 5. Forms: All modals/bottom sheets open/close correctly; focus trapped; Escape key works
 6. Touch targets: All interactive elements >= 48px on mobile (use browser DevTools device mode)
 7. Accessibility: Tab through all pages with keyboard; test with screen reader; check color contrast with browser audit
 8. Performance: Run Lighthouse mobile audit — target Performance > 90, Accessibility > 95; verify lazy loading works (check network tab for chunked route loads)   
 9. Error resilience: Temporarily break an API endpoint — ErrorBoundary should show fallback, not crash the app

 Device testing targets

 - iPhone SE (375px), iPhone 14 (390px), Pixel 7 (412px)
 - iPad Mini (768px), iPad Air (820px)
 - Desktop: 1280px, 1440px