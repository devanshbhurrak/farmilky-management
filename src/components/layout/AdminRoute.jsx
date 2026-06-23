import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingScreen from "../ui/LoadingScreen";

export default function AdminRoute() {
  const { user, authLoading, isAdmin, isDeliveryPartner } = useAuth();

  if (authLoading) {
    return <LoadingScreen text="Verifying access..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return isDeliveryPartner
      ? <Navigate to="/deliveries" replace />
      : <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
