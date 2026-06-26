export const navItems = [
  { id: "overview", label: "Overview", path: "/", icon: "overview" },
  { id: "deliveries", label: "Delivery Board", path: "/deliveries", icon: "deliveries" },
  { id: "manifests", label: "Manifests", path: "/manifests", icon: "manifests" },
  { id: "orders", label: "Orders", path: "/orders", icon: "orders" },
  { id: "subscriptions", label: "Subscriptions", path: "/subscriptions", icon: "subscriptions" },
  { id: "customers", label: "Customers", path: "/customers", icon: "customers" },
  { id: "products", label: "Products", path: "/products", icon: "products" },
  { id: "balances", label: "Outstanding Balances", path: "/invoices", icon: "invoices" },
  { id: "areas", label: "Areas", path: "/areas", icon: "areas" },
  { id: "agents", label: "Agents", path: "/agents", icon: "agents" },
  { id: "suppliers", label: "Suppliers", path: "/suppliers", icon: "suppliers" },
  { id: "milk-collections", label: "Milk Collections", path: "/milk-collections", icon: "collections" },
  { id: "complaints", label: "Complaints", path: "/complaints", icon: "complaints" },
  { id: "returns", label: "Returns", path: "/returns", icon: "returns" },
  { id: "holidays", label: "Holidays", path: "/holidays", icon: "holidays" },
  { id: "messages", label: "Contact Messages", path: "/messages", icon: "messages" },
];

export const deliveryNavItems = [
  { id: "agent", label: "Dashboard", path: "/agent", icon: "overview" },
  { id: "deliveries", label: "Delivery Board", path: "/deliveries", icon: "deliveries" },
];

export const orderStatusOptions = ["confirmed", "delivered", "cancelled"];

export const subscriptionStatusOptions = ["active", "paused", "cancelled"];

export const categoryOptions = ["milk", "ghee", "paneer", "curd", "butter", "cheese", "other"];

export const unitOptions = ["L", "ml", "kg", "g", "unit"];

export const paymentStatusOptions = ["unpaid", "partial", "paid"];

export const deliveryTypeOptions = ["subscription", "order"];

export const roleOptions = ["customer", "admin", "agent"];
