import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to first-login if password must be changed (unless already on first-login)
  if (mustChangePassword && location.pathname !== '/first-login') {
    return <Navigate to="/first-login" replace />;
  }

  // Redirect away from first-login if password doesn't need to be changed
  if (!mustChangePassword && location.pathname === '/first-login') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

