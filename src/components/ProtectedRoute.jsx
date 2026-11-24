import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Protects a route so only authenticated users can access it.
 * Unauthenticated users are redirected to /login with the intended location
 * stored so they can be sent back after signing in.
 *
 * Only waits for the sign-in state, not for the profile, so the page appears as
 * soon as Firebase knows who the user is.
 */
export function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * Protects a route so only staff/admin users can access it.
 * Waits for roles to load, otherwise an admin would be redirected away on refresh.
 * This is a frontend guard; the server also re-verifies on every API call.
 */
export function AdminRoute({ children }) {
  const { loading, rolesReady, isAdmin, isAuthenticated } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: { pathname: "/admin" } }} replace />;
  }

  if (!rolesReady) return null;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
