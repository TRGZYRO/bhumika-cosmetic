import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Protects a route so only authenticated users can access it.
 * Unauthenticated users are redirected to /login with the intended location
 * stored so they can be sent back after signing in.
 */
export function ProtectedRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // While Firebase initialises, don't render anything (avoid flashing
  // protected content or redirecting prematurely).
  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * Protects a route so only staff/admin users can access it.
 * Admin authorization is derived from roles loaded via Firebase + Supabase.
 * This is a frontend guard; the server also re-verifies on every API call.
 */
export function AdminRoute({ children }) {
  const { user, loading, isAdmin, isAuthenticated } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: { pathname: "/admin" } }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
