# Farmilky Management Dashboard

A comprehensive admin dashboard for managing dairy/food delivery operations: products, customers, subscriptions, orders, payments, pages, and global settings.

---

## Tech Stack

| Layer        | Technology                                            |
| ------------ | ----------------------------------------------------- |
| Frontend     | React 18 + React Router v6                            |
| Backend      | Node.js + Express + MySQL2                            |
| Auth         | JWT + bcryptjs                                        |
| Styling      | CSS Modules + react-icons                             |
| State        | React context (AuthContext, ToastContext)              |
| HTTP Client  | Axios                                                 |

---

## Project Structure

```
farmilky-management/
├── public/
│   └── index.html
├── src/
│   ├── components/          # Shared UI components
│   ├── context/             # React context providers
│   ├── pages/               # Route-level page components
│   ├── services/            # API layer, auth helpers
│   ├── styles/              # Global CSS + CSS Modules
│   ├── App.jsx              # Router + layout wrapper
│   ├── App.css
│   └── index.js             # ReactDOM entry point
├── server/
│   ├── config/              # DB connection
│   ├── middleware/          # Auth middleware
│   ├── routes/              # Express route handlers
│   ├── server.js            # Express entry point
│   └── farmilky_schema.sql  # Database schema
├── .env                     # Environment variables
└── package.json
```

---

## Setup & Installation

### Prerequisites
- Node.js >= 16
- MySQL 8+
- npm

### Steps

1. Clone and install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root with:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=farmilky
JWT_SECRET=your_jwt_secret
```

3. Set up the database:

```bash
mysql -u root -p < server/farmilky_schema.sql
```

4. Update `src/services/api.js` with the correct backend URL (defaults to `http://localhost:5000`).

5. Start the backend:

```bash
node server/server.js
```

6. In a separate terminal, start the frontend:

```bash
npm start
```

The app runs on `http://localhost:3000`.

### Default Login Credentials

| Role     | Email               | Password  |
| -------- | ------------------- | --------- |
| Admin    | admin@farmilky.com  | admin123  |
| Employee | employee@farmilky.com | employee123 |

---

## Architecture Overview

### Frontend (`src/`)

#### Entry Point (`src/index.js`)
- Renders `<App />` wrapped in `<AuthProvider>` and `<ToastProvider>` (in the correct nesting order: Auth outer, Toast inner).

#### App & Routing (`src/App.jsx`)
- **Auth guard**: `<ProtectedRoute />` wraps all authenticated pages; redirects to `/login` if no token.
- **Employee guard**: `<EmployeeRoute />` wraps employee-only pages; redirects to `/` if the user is not an employee.
- **Layout**: `<Sidebar>` is rendered on all authenticated pages.
- **Toast container** is rendered globally for notifications.
- Routes:
  | Path                        | Component           | Access      |
  | --------------------------- | ------------------- | ----------- |
  | `/login`                    | LoginPage           | Public      |
  | `/`                         | DashboardPage       | Admin/Employee |
  | `/products`                 | ProductsPage        | Admin/Employee |
  | `/product-orders`           | ProductOrdersPage   | Admin/Employee |
  | `/customers`                | CustomersPage       | Admin/Employee |
  | `/subscriptions`            | SubscriptionsPage   | Admin/Employee |
  | `/orders`                   | OrdersPage          | Admin/Employee |
  | `/employees`                | EmployeesPage       | Admin only  |
  | `/settings`                 | SettingsPage        | Admin only  |
  | `/pages`                    | PagesPage           | Admin/Employee |
  | `/pages/:slug`              | PageEditorPage      | Admin/Employee |
  | `/products/new`             | ProductFormPage     | Admin/Employee (employee-guarded) |
  | `/products/edit/:id`        | ProductFormPage     | Admin/Employee (employee-guarded) |

---

### Components (`src/components/`)

#### `<Sidebar />`
- Fixed left navigation with links grouped by section.
- User info (avatar, name, role) at top.
- Props: `onRefresh` — callback to refresh page data.
- Highlights active route.
- "Sign Out" button calls `logout()` from AuthContext.

#### `<ProtectedRoute />`
- Reads `user` from `AuthContext`.
- If no user, redirects to `/login` with the intended path saved in state (post-login redirect).
- If user exists, renders `children`.

#### `<EmployeeRoute />`
- Reads `user` from `AuthContext`.
- If no user, redirects to `/login`.
- If user is not an Employee, redirects to `/`.
- Otherwise renders `children`.

#### `<Toast />`
- Displays a single toast notification with type-based styling (success/error/info).
- Auto-dismisses after 5 seconds.
- Close button.

#### `<Loader />`
- Full-screen centered spinner overlay.
- Used during API calls to block interaction.

#### `<Modal />`
- Reusable modal overlay with:
  - `isOpen` / `onClose` props
  - Optional `title`
  - Content via `children`
  - Click-outside-to-close and Escape key support.

---

### Context (`src/context/`)

#### AuthContext (`src/context/AuthContext.jsx`)
- Provides `user`, `loading`, `login(email, password)`, `logout()`.
- On mount, checks `localStorage` for a stored token, validates it by fetching user profile.
- `login()` stores token in localStorage and sets user state.
- `logout()` clears token and user state.

#### ToastContext (`src/context/ToastContext.jsx`)
- Provides `showToast(message, type)`.
- Manages an array of toasts with auto-generated IDs.
- Types: `'success'`, `'error'`, `'info'`.

---

### API Layer (`src/services/`)

#### `src/services/api.js`
- Axios instance with `baseURL` from `process.env.REACT_APP_API_URL` (falls back to `http://localhost:5000`).
- **Request interceptor**: attaches `Authorization: Bearer <token>` from localStorage.
- **Response interceptor**: on 401, clears token and redirects to `/login`.

#### `src/services/auth.js`
- `loginUser(email, password)` → POST `/api/auth/login`
- `getUser()` → GET `/api/auth/me`

---

### Pages (`src/pages/`)

All admin/employee pages follow a consistent pattern:
1. **State** for data, loading, error, search/filter terms.
2. **`useEffect` + `useCallback`** fetches data via the service layer.
3. **Loading spinner** while fetching.
4. **Search + filters** at the top.
5. **Table/grid** displaying results.
6. **CRUD actions** (create, edit, delete, toggle status) with confirmation modals.
7. **Toast notifications** for success/error feedback.

#### **DashboardPage**
- Displays summary cards: total products, customers, subscriptions, orders, revenue.
- Recent activity feed.
- Quick action buttons.
- Calls: `api.get('/api/dashboard')`.

#### **ProductsPage**
- Table: image, name, category, price, unit, stock, status, actions.
- Search by name, filter by category/status.
- Toggle product active/inactive via `PATCH /api/products/:id/status`.
- Delete with confirmation modal.
- EmployeeRoute-guarded actions (new/edit).

#### **ProductFormPage**
- Used for both create and edit (`/:id?`).
- Fields: name, description, price, stock, unit, category, image URL, status.
- "Back to Products" button.
- Calls: `POST /api/products` or `PUT /api/products/:id`.
- Wrapped in `<EmployeeRoute>`.

#### **ProductOrdersPage**
- Placed via the public-facing site; viewed/managed here.
- Table: order ID, customer, items, total amount, status, date, actions.
- Status management (pending, confirmed, shipped, delivered, cancelled).
- Search by order ID or customer name.

#### **CustomersPage**
- Table: name, email, phone, total orders, status, actions.
- View customer details in a modal (orders + subscription info).
- Toggle customer active/inactive.

#### **SubscriptionsPage**
- Table: customer, plan, amount, start date, next billing, status, actions.
- Search by customer name or plan.
- Pause/resume subscriptions.
- Cancel subscriptions with confirmation.

#### **OrdersPage**
- Grocery/one-time delivery orders placed through the public site.
- Table: order ID, customer, items, total, status, date, actions.
- Status management (confirmed, preparing, out for delivery, delivered, cancelled).
- Search by order ID or customer name.

#### **EmployeesPage**
- Admin-only employee management.
- Table: name, email, role, status, actions.
- Create new employees via modal form.
- Edit employee details.
- Toggle active/inactive.

#### **SettingsPage**
- Admin-only global application settings.
- Editable fields (name/value pairs).
- Save changes button.
- Default settings seeded on first run.

#### **PagesPage**
- List of CMS pages (e.g., About Us, FAQ, Contact).
- Table: title, slug, status, last updated, actions.
- Toggle publish/draft status.

#### **PageEditorPage**
- Full-page editor for CMS content.
- Route param `:slug` identifies the page.
- Rich text editor for content.
- Publish/draft toggle.
- Save button.

---

### Styling (`src/styles/`)

- **`global.css`** — CSS variables, reset, layout, sidebar, form, modal, toast, loader, table, utility classes.
- **CSS Modules** per page (e.g., `ProductsPage.module.css`, `CustomersPage.module.css`).
- Consistent design system via CSS custom properties.

---

## Backend (`server/`)

### Database (`server/farmilky_schema.sql`)
- Tables: `users`, `products`, `customers`, `subscriptions`, `orders`, `order_items`, `employees`, `settings`, `pages`.
- Pre-seeded admin and employee accounts.
- Proper foreign key relationships.

### Server Entry (`server/server.js`)
- Express app with CORS, JSON body parsing.
- Serves static files from `farmilky-website` in production.
- Falls back to `index.html` for SPA routing.

### Authentication (`server/middleware/auth.js`)
- JWT verification middleware.
- Extracts user from token, attaches to `req.user`.
- Employee role check middleware.

### Routes (`server/routes/`)
- `auth.js` — login, profile, employee creation.
- `products.js` — full CRUD + status toggle.
- `customers.js` — list, detail, status toggle.
- `subscriptions.js` — list, pause/resume, cancel.
- `orders.js` — list, status update, detail.
- `employees.js` — CRUD, status toggle (admin only).
- `settings.js` — get/update global settings.
- `pages.js` — CRUD for CMS pages.
- `dashboard.js` — aggregated stats.
- `productOrders.js` — manage product orders from public site.

---

## Available Scripts

| Script            | Description              |
| ----------------- | ------------------------ |
| `npm start`       | Start React dev server   |
| `npm run build`   | Production build         |
| `node server/server.js` | Start backend       |

---

## Environment Variables

| Variable              | Required | Default               | Description           |
| --------------------- | -------- | --------------------- | --------------------- |
| `PORT`                | Yes      | `5000`                | Backend port          |
| `DB_HOST`             | Yes      | `localhost`           | MySQL host            |
| `DB_USER`             | Yes      | `root`                | MySQL user            |
| `DB_PASSWORD`         | Yes      | —                     | MySQL password        |
| `DB_NAME`             | Yes      | `farmilky`            | MySQL database name   |
| `JWT_SECRET`          | Yes      | —                     | JWT signing secret    |
| `REACT_APP_API_URL`   | No       | `http://localhost:5000` | Backend URL (frontend) |
