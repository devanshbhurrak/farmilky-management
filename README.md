# Farmilky Management Dashboard

The staff/admin portal for the Farmilky milk & dairy delivery platform. Manage orders, subscriptions, customers, products, invoices, areas, delivery agents, manifests, holidays, suppliers, milk collections, complaints, returns, and contact messages.

This is a **frontend-only SPA** (Vite + React) that consumes the shared Farmilky backend API over HTTP-only cookie sessions.

---

## Tech Stack

| Layer        | Technology                                            |
| ------------ | ----------------------------------------------------- |
| Framework    | React 19 (Hooks, lazy-loaded routes)                  |
| Build Tool   | Vite 8                                                |
| Routing      | React Router v7                                       |
| HTTP Client  | Native `fetch` wrapper (`src/api/client.js`)          |
| State        | React Context (AuthContext, PortalDataContext)        |
| Notifications| React Hot Toast                                       |
| Icons        | Lucide React                                          |
| Styling      | Custom CSS (variables, layout, components, tables, forms, responsive + per-page styles) |

> Requires the **backend** project (Express + MongoDB) for all API calls.

---

## Project Structure

```
farmilky-management/
├── public/                    # favicon, sprite icons
├── src/
│   ├── api/
│   │   └── client.js          # fetch wrapper (base URL, credentials)
│   ├── components/
│   │   ├── customer/          # CustomerForm
│   │   ├── delivery/          # DeliveryCard, BulkActionsBar, Filters, OutcomeModal...
│   │   ├── icons/             # NavIcon
│   │   ├── layout/            # Sidebar, Topbar, BottomNav, MobileDrawer, guards
│   │   ├── order/             # OrderForm
│   │   ├── product/           # ProductForm
│   │   ├── subscription/      # SubscriptionForm
│   │   └── ui/                # DataTable, Modal, ConfirmDialog, BottomSheet,
│   │                          #   Pagination, SearchInput, StatusTag, skeletons...
│   ├── context/
│   │   ├── AuthContext.jsx        # staff session (admin / delivery partner)
│   │   └── PortalDataContext.jsx  # shared dashboard/portal data + refresh
│   ├── hooks/
│   │   ├── useApiData.js          # cached API data fetching
│   │   ├── useDebounce.js
│   │   ├── useFocusTrap.js
│   │   ├── useMediaQuery.js
│   │   └── useBodyScrollLock.js
│   ├── pages/                 # Route-level page components
│   ├── styles/                # Global CSS + per-page stylesheets
│   ├── utils/                 # constants, formatting helpers
│   ├── App.jsx                # Router + layout shell
│   ├── index.css
│   └── main.jsx               # ReactDOM entry point + providers
├── .env                       # VITE_BACKEND_BASEURL
├── package.json
├── vercel.json
└── vite.config.js
```

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- npm
- A running Farmilky backend (see the `backend` project)

### Steps

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure the backend URL:**

   Create a `.env` file in the project root:

   ```env
   VITE_BACKEND_BASEURL=http://localhost:4000
   ```

3. **Start the dev server:**

   ```bash
   npm run dev
   ```

   The app runs on `http://localhost:5173`.

Other scripts: `npm run build` (production build), `npm run lint` (ESLint), `npm run preview` (preview the production build).

### Login
Only staff accounts can use the portal. The portal accepts users with role `admin` or `delivery_partner` (legacy `delivery` / `agent` also recognized) from the backend's `/api/user/login`; customer accounts are rejected with "This portal is for staff only."

---

## Routes

| Path                      | Component              | Access           |
| ------------------------- | ---------------------- | ---------------- |
| `/login`                  | LoginPage              | Public           |
| `/`                       | DashboardPage          | Admin            |
| `/orders`                 | OrdersPage             | Admin            |
| `/orders/:id`             | OrderDetailPage        | Admin            |
| `/subscriptions`          | SubscriptionsPage      | Admin            |
| `/subscriptions/:id`      | SubscriptionDetailPage | Admin            |
| `/customers`              | CustomersPage          | Admin            |
| `/customers/:id`          | CustomerDetailPage     | Admin            |
| `/products`               | ProductsPage           | Admin            |
| `/invoices`               | BalancesPage           | Admin            |
| `/areas`                  | AreasPage              | Admin            |
| `/areas/:id/customers`    | AreaCustomersPage      | Admin            |
| `/agents`                 | AgentsPage             | Admin            |
| `/agents/:id`             | AgentDetailPage        | Admin            |
| `/complaints`             | ComplaintsPage         | Admin            |
| `/returns`                | ReturnsPage            | Admin            |
| `/holidays`               | HolidaysPage           | Admin            |
| `/messages`               | ContactMessagesPage    | Admin            |
| `/manifests`              | ManifestsPage          | Admin            |
| `/manifests/:id`          | ManifestDetailPage     | Admin            |
| `/suppliers`              | SuppliersPage          | Admin            |
| `/suppliers/:id`          | SupplierDetailPage     | Admin            |
| `/milk-collections`       | MilkCollectionsPage    | Admin            |
| `/deliveries`             | DeliveriesPage         | Delivery partner |
| `/agent`                  | AgentDashboardPage     | Delivery partner |
| `/agent/manifest/:id`     | ManifestDetailPage     | Delivery partner |

Admin-area routes are wrapped in `<AdminRoute>` (redirects delivery partners to `/deliveries`); the delivery pages are accessible to delivery-partner roles.

---

## Components (`src/components/`)

### Layout
- **`<Sidebar />`** - collapsible left navigation grouped by section; highlights the active route.
- **`<Topbar />`** - dashboard header with last-updated timestamp and refresh action.
- **`<BottomNav />`** / **`<MobileDrawer />`** / **`<MobileHeader />`** - mobile navigation.
- **`<ProtectedRoute />`** - requires a staff session; redirects to `/login` otherwise.
- **`<AdminRoute />`** - admin-only; delivery partners are redirected to the deliveries view.
- **`<UserMenu />`** - account menu and sign-out (`POST /api/user/logout`).

### UI kit (`components/ui/`)
`DataTable`, `Modal`, `BottomSheet`, `RightDrawer`, `ConfirmDialog`, `FilterSheet`, `SearchInput`, `Pagination`, `StatusTag`, `QuickChips`, `MetricChip`, `InfoCard`, `PageHeader`, `Breadcrumbs`, `ActionRow`, `StickyActionBar`, `IconDropdown`, `EmptyState`, `ErrorBoundary`, `PageError`, `LoadingScreen`, `LoadingSkeleton`, `PageSkeleton`.

### Domain forms (`components/{customer,order,product,subscription}/`)
`CustomerForm`, `OrderForm`, `ProductForm`, `SubscriptionForm`.

### Delivery (`components/delivery/`)
`DeliveryCard`, `DeliveryFilters`, `BulkActionsBar`, `OutcomeForm`, `OutcomeModal` - used by delivery partners to record delivery outcomes.

---

## Context & Hooks (`src/context/`, `src/hooks/`)

### AuthContext
- Restores the session on mount by fetching `/api/user/profile`; logs out if the user is not a staff role.
- Exposes `user`, `authLoading`, `isAdmin`, `isDeliveryPartner`, `login(email, password)`, `logout()`.
- Listens for the `auth:unauthorized` window event to clear the session (e.g. on 401).

### PortalDataContext
- Loads shared dashboard data once and refreshes across pages via `refreshData(force)`; tracks `lastUpdatedAt`.
- Used by DashboardPage, OrdersPage, SubscriptionsPage, and the topbar refresh action.

### Hooks
`useApiData` (cached fetches with `clearApiCache`), `useDebounce`, `useFocusTrap`, `useMediaQuery`, `useBodyScrollLock`.

---

## API Layer (`src/api/client.js`)
- `apiRequest(path, options)` - `fetch` wrapper using `VITE_BACKEND_BASEURL` (default `http://localhost:4000`) with `credentials: "include"` so the backend cookie is sent.
- `safeParseJson(response)` - JSON parsing that tolerates empty bodies.

---

## Pages (`src/pages/`)

Pages follow a consistent pattern: state + `useApiData`/hooks for data, loading skeletons/spinners, search & filters, a table/card grid, and CRUD actions with confirmation dialogs and toast feedback.

- **DashboardPage** - summary cards (revenue, orders, subscriptions, customers, etc.), recent activity, quick actions; live order/subscription status updates.
- **OrdersPage / OrderDetailPage** - manage customer orders and statuses (confirmed, preparing, out for delivery, delivered, cancelled).
- **SubscriptionsPage / SubscriptionDetailPage** - subscription list, detail, pause/resume/cancel, delivery history.
- **CustomersPage / CustomerDetailPage** - customer list, details (subscriptions, passbook), status toggles.
- **ProductsPage** - product catalog CRUD, stock, status toggles.
- **BalancesPage** - customer passbook/invoice balances.
- **AreasPage / AreaCustomersPage** - delivery areas and their assigned customers.
- **AgentsPage / AgentDetailPage** - delivery agent CRUD, area assignment, performance.
- **ComplaintsPage** - customer complaints and status updates.
- **ReturnsPage** - return requests and status updates.
- **HolidaysPage** - no-delivery days (scheduler is holiday-aware).
- **ContactMessagesPage** - contact form submissions from the public site.
- **ManifestsPage / ManifestDetailPage** - daily delivery sheets: generate by date, resequence, edit entries.
- **SuppliersPage / SupplierDetailPage** - supplier CRUD, passbook, adjustments, payments.
- **MilkCollectionsPage** - daily milk collection shift, bulk confirmation, missing collections.
- **DeliveriesPage** - delivery partner's today/history board with bulk actions and outcome recording.
- **AgentDashboardPage** - delivery partner's daily summary and manifest access.

---

## Styling (`src/styles/`)

- `variables.css`, `layout.css`, `components.css`, `tables.css`, `forms.css`, `responsive.css` - shared design system via CSS custom properties.
- `pages/*.css` - per-module styles (dashboard, deliveries, products, manifests, invoices, areas, support, suppliers, milk-collections, customers, orders, subscriptions).
- Fully responsive: sidebar collapses to a bottom nav + drawer on mobile.

---

## Deployment (Vercel)
1. Push this directory to its own GitHub repository.
2. Link the repository to your Vercel account.
3. `vercel.json` rewrites all routes to `index.html` for SPA routing.
4. Set `VITE_BACKEND_BASEURL` in the Vercel project settings to the deployed backend URL (e.g. `https://farmilky-backend.vercel.app`).

---

## Related Projects
- **backend/** - Express + MongoDB REST API powering this portal
- **frontend/** - customer-facing storefront (same backend)