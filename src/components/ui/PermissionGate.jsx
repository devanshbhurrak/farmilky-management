import { usePermission } from "../../hooks/usePermission";

/**
 * Conditionally renders children based on a permission key.
 *
 * Usage:
 *   <PermissionGate permission="collection.record">
 *     <RecordCollectionButton />
 *   </PermissionGate>
 *
 *   <PermissionGate permission="manifest.update" fallback={<p>Access denied.</p>}>
 *     <UpdateForm />
 *   </PermissionGate>
 */
export default function PermissionGate({ permission, fallback = null, children }) {
  const allowed = usePermission(permission);
  return allowed ? children : fallback;
}
