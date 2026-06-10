import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingScreen from "../ui/LoadingScreen";

export default function ProtectedRoute() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return <LoadingScreen text="Connecting to Farmilky operations..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
