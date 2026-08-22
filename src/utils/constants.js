export const navItems = [
  { id: "overview", label: "Overview", path: "/", icon: "overview" },
  { id: "deliveries", label: "Delivery Board", path: "/deliveries", icon: "deliveries" },
  { id: "customers", label: "Customers", path: "/customers", icon: "customers" },
  { id: "orders", label: "Orders", path: "/orders", icon: "orders" },
  { id: "subscriptions", label: "Subscriptions", path: "/subscriptions", icon: "subscriptions" },
  { id: "suppliers", label: "Suppliers", path: "/suppliers", icon: "suppliers" },
  { id: "milk-collections", label: "Milk Collections", path: "/milk-collections", icon: "collections" },
  { id: "balances", label: "Outstanding Balances", path: "/invoices", icon: "invoices" },
  { id: "products", label: "Products", path: "/products", icon: "products" },
  { id: "areas", label: "Areas", path: "/areas", icon: "areas" },
  { id: "agents", label: "Agents", path: "/agents", icon: "agents" },
  { id: "manifests", label: "Manifests", path: "/manifests", icon: "manifests" },
  { id: "complaints", label: "Complaints", path: "/complaints", icon: "complaints" },
  { id: "returns", label: "Returns", path: "/returns", icon: "returns" },
  { id: "holidays", label: "Holidays", path: "/holidays", icon: "holidays" },
  { id: "messages", label: "Contact Messages", path: "/messages", icon: "messages" },
  { id: "permissions", label: "Permissions", path: "/permissions", icon: "permissions" },
];

/**
 * Delivery agent navigation items.
 * Each item may carry an optional `permission` key — if set, the item is only
 * shown when the agent has that permission (filtered in Sidebar, BottomNav, MobileDrawer).
 */
export const deliveryNavItems = [
  { id: "agent",       label: "Dashboard",     path: "/agent",              icon: "overview",     permission: "manifest.view_today" },
  { id: "deliveries",  label: "Delivery Board", path: "/deliveries",         icon: "deliveries",   permission: "delivery_board.view" },
  { id: "collections", label: "Collections",    path: "/agent/collections",  icon: "collections",  permission: "collection.view_history" },
  { id: "history",     label: "History",        path: "/agent/history",      icon: "manifests",    permission: "manifest.view_history" },
  { id: "profile",     label: "My Profile",     path: "/agent/profile",      icon: "agents",       permission: "profile.view" },
];

export const orderStatusOptions = ["confirmed", "delivered", "cancelled"];

export const subscriptionStatusOptions = ["active", "paused", "cancelled"];

export const categoryOptions = ["milk", "ghee", "paneer", "curd", "butter", "cheese", "other"];

export const unitOptions = ["L", "ml", "kg", "g", "unit"];

export const paymentStatusOptions = ["unpaid", "partial", "paid"];

export const deliveryTypeOptions = ["subscription", "order"];

export const roleOptions = ["customer", "admin", "agent"];
