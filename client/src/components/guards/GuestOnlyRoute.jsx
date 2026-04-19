import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../context/useAuth.js";
import Spinner from "../ui/Spinner.jsx";

/**
 * GuestOnlyRoute — inverse of `ProtectedRoute`: only renders for visitors
 * who are NOT signed in. Used by `/login` and `/register` so an already
 * authenticated user gets bounced back to the feed instead of seeing a
 * useless form.
 */
export default function GuestOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner fullScreen />;

  if (user) return <Navigate to="/" replace />;

  return children ?? <Outlet />;
}
