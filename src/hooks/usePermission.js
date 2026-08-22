import { useAuth } from "../context/AuthContext";

/**
 * Returns true if the current user has the given permission key.
 * Admin always returns true. If no permission key is provided, returns true.
 *
 * Usage:
 *   const canRecord = usePermission("collection.record");
 */
export function usePermission(permission) {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}
