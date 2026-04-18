import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import Spinner from "../ui/Spinner.jsx";

/**
 * AdminRoute — strict superset of `ProtectedRoute`: the user must be
 * authenticated AND have the admin role.
 *
 * Defense in depth: the server enforces the same check on every admin
 * endpoint (see `server/middleware/adminOnly.js`); this guard exists to
 * keep the UI honest and avoid leaking admin-only routes to regular users.
 */
export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner fullScreen />;

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  return children ?? <Outlet />;
}
