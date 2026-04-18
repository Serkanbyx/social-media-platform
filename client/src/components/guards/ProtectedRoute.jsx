import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import Spinner from "../ui/Spinner.jsx";

/**
 * ProtectedRoute — gates child routes behind a valid session.
 *
 * While the auth bootstrap is in flight (`loading`) we render a full-screen
 * spinner instead of either the protected page or the login screen, so
 * the user never sees a flash of the wrong layout (FOWP).
 *
 * On redirect we preserve the attempted URL in `state.from` so the login
 * page can send the user back where they were trying to go.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner fullScreen />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children ?? <Outlet />;
}
