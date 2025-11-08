import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { adminApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useWS } from '@/hooks/useWS';
import { Navigate } from 'react-router-dom';

export function SettingsUsers() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Redirect non-admin users
  if (currentUser && currentUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Fetch all users
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getAllUsers(),
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'employee' | 'admin' | 'hr' | 'payroll' }) => {
      console.log('Updating role via API:', { userId, role });
      return adminApi.updateUserRole(userId, role);
    },
    onSuccess: (updatedUser) => {
      console.log('Role update successful, updated user:', updatedUser);
      // Refetch the users list to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      // Also optimistically update the cache for immediate UI feedback
      queryClient.setQueryData<typeof users>(['admin-users'], (old) => {
        if (!old) return old;
        return old.map((u) => (u.id === updatedUser.id ? updatedUser : u));
      });
      toast.success('User role updated successfully');
    },
    onError: (error) => {
      console.error('Role update error:', error);
      toast.error(getErrorMessage(error));
    },
  });

  // Handle role change
  const handleRoleChange = (userId: string, newRole: 'employee' | 'admin' | 'hr' | 'payroll') => {
    // Prevent admin from changing their own role
    if (userId === currentUser?.id && currentUser?.role === 'admin' && newRole !== 'admin') {
      toast.error('You cannot change your own role.');
      return;
    }

    updateRoleMutation.mutate({ userId, role: newRole });
  };

  // Listen for real-time updates
  useWS({
    onMessage: (event) => {
      if (event.table === 'users' && event.op === 'UPDATE' && event.row) {
        // Invalidate and refetch users list
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      }
    },
  });

  // Map role values to display labels
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'employee':
        return 'Employee';
      case 'hr':
        return 'HR Officer';
      case 'payroll':
        return 'Payroll Officer';
      case 'admin':
        return 'Admin';
      default:
        return role;
    }
  };

  // Map display labels to role values
  const getRoleValue = (label: string): 'employee' | 'admin' | 'hr' | 'payroll' => {
    switch (label) {
      case 'Employee':
        return 'employee';
      case 'HR Officer':
        return 'hr';
      case 'Payroll Officer':
        return 'payroll';
      case 'Admin':
        return 'admin';
      default:
        return 'employee';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Access Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage user roles and access permissions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Login ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isCurrentUser = user.id === currentUser?.id;
                    const isUpdating = updateRoleMutation.isPending && updateRoleMutation.variables?.userId === user.id;

                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.loginId || '-'}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Select
                            value={getRoleLabel(user.role)}
                            onValueChange={(value) => {
                              if (!(isCurrentUser && currentUser?.role === 'admin')) {
                                handleRoleChange(user.id, getRoleValue(value));
                              }
                            }}
                            disabled={(isCurrentUser && currentUser?.role === 'admin') || isUpdating}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Employee">Employee</SelectItem>
                              <SelectItem value="HR Officer">HR Officer</SelectItem>
                              <SelectItem value="Payroll Officer">Payroll Officer</SelectItem>
                              <SelectItem value="Admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          {isUpdating && (
                            <Loader2 className="ml-2 h-4 w-4 animate-spin inline-block" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

