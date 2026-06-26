import {
  LayoutDashboard,
  Truck,
  ClipboardList,
  Repeat,
  Users,
  Package,
  FileText,
  Circle,
  MapPin,
  Calendar,
  Clipboard,
  UserCheck,
  MessageSquare,
  RotateCcw,
  Mail,
  Users2,
  Milk,
} from "lucide-react";

const NAV_ICONS = {
  overview: LayoutDashboard,
  deliveries: Truck,
  orders: ClipboardList,
  subscriptions: Repeat,
  customers: Users,
  products: Package,
  invoices: FileText,
  areas: MapPin,
  holidays: Calendar,
  manifests: Clipboard,
  agents: UserCheck,
  complaints: MessageSquare,
  returns: RotateCcw,
  messages: Mail,
  suppliers: Users2,
  collections: Milk,
};

export default function NavIcon({ name, size = 20, strokeWidth = 1.75 }) {
  const Icon = NAV_ICONS[name] || Circle;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden />;
}
