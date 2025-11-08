import { useAuth } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { AccessDenied } from '@/components/hrms/AccessDenied';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  feature?: string;
}

/**
 * Role-based protected route wrapper
 * Checks if user has one of the allowed roles, otherwise shows access denied message
 */
export function RoleProtectedRoute({ 
  children, 
  allowedRoles,
  feature
}: RoleProtectedRouteProps) {
  return (
    <ProtectedRoute>
      <RoleCheck allowedRoles={allowedRoles} feature={feature}>
        {children}
      </RoleCheck>
    </ProtectedRoute>
  );
}

function RoleCheck({ 
  children, 
  allowedRoles,
  feature
}: RoleProtectedRouteProps) {
  const { user } = useAuth();

  if (!user) {
    return null; // ProtectedRoute handles this
  }

  if (!allowedRoles.includes(user.role)) {
    return <AccessDenied allowedRoles={allowedRoles} feature={feature} />;
  }

  return <>{children}</>;
}

