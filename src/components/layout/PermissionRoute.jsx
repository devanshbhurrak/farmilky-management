import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePermission } from "../../hooks/usePermission";
import { deliveryNavItems } from "../../utils/constants";
import LoadingScreen from "../ui/LoadingScreen";

/**
 * Route guard that enforces a specific permission.
 *
 * Redirect logic when denied:
 * - Unauthenticated → /login
 * - Admin (should never fail) → / (admin dashboard)
 * - Agent without permission → first permitted nav item, or /login if none allowed
 */
export default function PermissionRoute({ permission }) {
  const { user, authLoading, isAdmin, hasPermission } = useAuth();
  const allowed = usePermission(permission);
  const location = useLocation();

  if (authLoading) return <LoadingScreen text="Checking permissions..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  // Admin always passes — if they somehow trigger this, send to dashboard
  if (isAdmin) return <Outlet />;

  if (!allowed) {
    // Find the first nav item the agent is actually permitted to access
    const firstAllowed = deliveryNavItems.find(
      (item) => !item.permission || hasPermission(item.permission)
    );

    if (firstAllowed && firstAllowed.path !== location.pathname) {
      return <Navigate to={firstAllowed.path} replace />;
    }

    // No permitted pages at all — show access denied (redirecting to login would be confusing)
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
