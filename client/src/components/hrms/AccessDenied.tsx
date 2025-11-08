import { useAuth } from '@/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
  allowedRoles: string[];
  feature?: string;
}

const roleDisplayNames: Record<string, string> = {
  admin: 'Admin',
  hr: 'HR Officer',
  manager: 'Payroll Officer',
  employee: 'Employee',
};

export function AccessDenied({ allowedRoles, feature = 'this page' }: AccessDeniedProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const userRole = user?.role || 'employee';
  const userRoleDisplay = roleDisplayNames[userRole] || userRole;
  const allowedRolesDisplay = allowedRoles.map((r) => roleDisplayNames[r] || r).join(', ');

  let message = '';
  if (userRole === 'employee') {
    message = `This feature is not accessible to employees. Only ${allowedRolesDisplay} can access ${feature}.`;
  } else {
    message = `You don't have permission to access ${feature}. This feature is only available to ${allowedRolesDisplay}.`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription className="mt-2 text-base">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-violet-50 border border-violet-200 p-4">
            <p className="text-sm font-medium mb-2 text-gray-600">Your Current Role:</p>
            <p className="text-lg font-semibold text-violet-900">{userRoleDisplay}</p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm font-medium mb-2 text-gray-600">Required Roles:</p>
            <p className="text-base font-medium text-blue-900">{allowedRolesDisplay}</p>
          </div>
          <Button 
            onClick={() => navigate('/hrms/dashboard')} 
            className="w-full"
            variant="default"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

