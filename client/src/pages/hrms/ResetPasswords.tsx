import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { authApi, hrmsApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Copy, Check } from 'lucide-react';

export function ResetPasswords() {
  const [selectedEmployee, setSelectedEmployee] = useState<{
    email: string;
    loginId: string;
  } | null>(null);
  const [resetResult, setResetResult] = useState<{
    login_id: string;
    temp_password: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Get all employees
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrmsApi.getAllEmployees(),
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: (result) => {
      setResetResult(result);
      toast.success('Password reset successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleResetPassword = (loginId: string, email: string) => {
    if (!loginId) {
      toast.error('Login ID not available');
      return;
    }
    setSelectedEmployee({ email, loginId });
    resetPasswordMutation.mutate({ login_id: loginId });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Copied to clipboard');
  };

  const handleCloseDialog = () => {
    setResetResult(null);
    setSelectedEmployee(null);
    resetPasswordMutation.reset();
  };

  // Map employees to list format
  const employeesList = employees?.map((emp: any) => ({
    id: emp.id,
    email: emp.userEmail || '',
    loginId: emp.userLoginId || emp.code || '', // Use login_id from user, fallback to employee code
    name: emp.userName || 'Unknown',
  })) || [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Reset Passwords</h1>
        <p className="text-muted-foreground mt-1">
          Reset employee passwords and generate temporary credentials
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : employeesList.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Login ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeesList.map((emp: any) => (
                    <TableRow key={emp.id}>
                      <TableCell>{emp.email || 'N/A'}</TableCell>
                      <TableCell className="font-mono">{emp.loginId || 'N/A'}</TableCell>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => handleResetPassword(emp.loginId, emp.email)}
                          disabled={!emp.loginId || resetPasswordMutation.isPending}
                          size="sm"
                        >
                          {resetPasswordMutation.isPending &&
                          selectedEmployee?.loginId === emp.loginId ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Resetting...
                            </>
                          ) : (
                            'Reset Password'
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No employees found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Result Dialog */}
      <Dialog open={!!resetResult} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset Successful</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Temporary credentials have been generated. Please send these to the employee via email.
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Login ID</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={resetResult?.login_id || ''}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(resetResult?.login_id || '', 'loginId')
                    }
                  >
                    {copied === 'loginId' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Temporary Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={resetResult?.temp_password || ''}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(resetResult?.temp_password || '', 'password')
                    }
                  >
                    {copied === 'password' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={handleCloseDialog}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

