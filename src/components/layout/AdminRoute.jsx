import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { deliveryNavItems } from "../../utils/constants";
import LoadingScreen from "../ui/LoadingScreen";

export default function AdminRoute() {
  const { user, authLoading, isAdmin, isDeliveryPartner, hasPermission } = useAuth();

  if (authLoading) {
    return <LoadingScreen text="Verifying access..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    if (isDeliveryPartner) {
      // Send agent to the first page they are allowed to see
      const firstAllowed = deliveryNavItems.find(
        (item) => !item.permission || hasPermission(item.permission)
      );
      return <Navigate to={firstAllowed?.path ?? "/login"} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
