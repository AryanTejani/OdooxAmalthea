import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Copy, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  companyName: z.string().min(1, 'Company name is required').optional(),
  role: z.enum(['admin', 'hr', 'payroll', 'employee']).default('employee'),
  orgUnitId: z.string().uuid().optional().or(z.literal('')),
  title: z.string().optional(),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  salaryConfig: z.object({
    basic: z.number().positive('Basic salary must be positive'),
    allowances: z.record(z.number()).optional(),
  }).optional(),
}).transform((data) => ({
  ...data,
  orgUnitId: data.orgUnitId === '' ? undefined : data.orgUnitId,
}));

type CreateEmployeeForm = z.infer<typeof createEmployeeSchema>;

interface CredentialsModalProps {
  open: boolean;
  onClose: () => void;
  loginId: string;
  tempPassword: string;
}

function CredentialsModal({ open, onClose, loginId, tempPassword }: CredentialsModalProps) {
  const [copiedLoginId, setCopiedLoginId] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const copyToClipboard = async (text: string, type: 'loginId' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'loginId') {
        setCopiedLoginId(true);
        setTimeout(() => setCopiedLoginId(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
      toast.success('Copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Credentials</DialogTitle>
          <DialogDescription>
            Credentials have been sent via email. Save these credentials securely. The user will need to change their password on first login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Login ID</Label>
            <div className="flex items-center gap-2">
              <Input value={loginId} readOnly className="font-mono" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(loginId, 'loginId')}
              >
                {copiedLoginId ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Temporary Password</Label>
            <div className="flex items-center gap-2">
              <Input value={tempPassword} readOnly className="font-mono" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(tempPassword, 'password')}
              >
                {copiedPassword ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> Credentials have been sent to the user's email address. They will be required to change their password on first login.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Employees() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{
    open: boolean;
    loginId: string;
    tempPassword: string;
  }>({ open: false, loginId: '', tempPassword: '' });

  // All authenticated users can view employees
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrmsApi.getAllEmployees(),
    enabled: !!user,
  });

  const { data: orgUnits } = useQuery({
    queryKey: ['orgUnits'],
    queryFn: () => hrmsApi.getOrgUnits(),
    enabled: !!user && (user.role === 'hr' || user.role === 'admin'),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CreateEmployeeForm>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      role: 'employee',
      joinDate: new Date().toISOString().split('T')[0],
    },
  });

  const selectedRole = watch('role');

  const createMutation = useMutation({
    mutationFn: (data: CreateEmployeeForm) => hrmsApi.createEmployee({
      ...data,
      companyName: undefined, // Remove companyName as it's deprecated
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('User created successfully! Credentials sent via email.');
      setCreateDialogOpen(false);
      reset();
      // Still show credentials modal in case email fails or admin wants to see them
      setCredentialsModal({
        open: true,
        loginId: result.credentials.loginId,
        tempPassword: result.credentials.tempPassword,
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const onSubmit = (data: CreateEmployeeForm) => {
    createMutation.mutate(data);
  };

  // Only HR Officer and Admin can create users
  // All users (including employees) can view the employee directory
  const canCreateUsers = user?.role === 'hr' || user?.role === 'admin';
  
  // Admin can create any role, HR can only create employee and payroll
  const availableRoles = user?.role === 'admin' 
    ? [
        { value: 'admin', label: 'Administrator' },
        { value: 'hr', label: 'HR Officer' },
        { value: 'payroll', label: 'Payroll Officer' },
        { value: 'employee', label: 'Employee' },
      ]
    : [
        { value: 'employee', label: 'Employee' },
        { value: 'payroll', label: 'Payroll Officer' },
      ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employee Directory</h1>
          <p className="text-muted-foreground mt-1">
            {canCreateUsers 
              ? 'Manage users and create new user accounts'
              : 'View employee directory'}
          </p>
        </div>
        {canCreateUsers && (
          <Button onClick={() => setCreateDialogOpen(true)}>Add User</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
          <CardDescription>
            {canCreateUsers
              ? 'User directory with management options. Click "Add User" to create new accounts.'
              : 'Browse the employee directory (read-only)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees && employees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Organization Unit</TableHead>
                  <TableHead>Join Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.userName || 'N/A'}</TableCell>
                    <TableCell>{emp.userEmail || 'N/A'}</TableCell>
                    <TableCell>{emp.code}</TableCell>
                    <TableCell>{emp.title || '-'}</TableCell>
                    <TableCell>{emp.orgUnit?.name || '-'}</TableCell>
                    <TableCell>{new Date(emp.joinDate).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No employees found</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Fill in the user details. Login ID and temporary password will be auto-generated and sent via email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  disabled={createMutation.isPending}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  {...register('lastName')}
                  disabled={createMutation.isPending}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                disabled={createMutation.isPending}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                {...register('phone')}
                disabled={createMutation.isPending}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={selectedRole || 'employee'}
                onValueChange={(value) => setValue('role', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {user?.role === 'hr' 
                  ? 'HR can only create Employee and Payroll Officer roles'
                  : 'Admin can create any role'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgUnitId">Organization Unit</Label>
              <select
                id="orgUnitId"
                {...register('orgUnitId')}
                disabled={createMutation.isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">None</option>
                {orgUnits?.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
              {errors.orgUnitId && (
                <p className="text-sm text-destructive">{errors.orgUnitId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                {...register('title')}
                disabled={createMutation.isPending}
                placeholder="e.g., Software Engineer"
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="joinDate">Join Date *</Label>
              <Input
                id="joinDate"
                type="date"
                {...register('joinDate')}
                disabled={createMutation.isPending}
              />
              {errors.joinDate && (
                <p className="text-sm text-destructive">{errors.joinDate.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Employee'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CredentialsModal
        open={credentialsModal.open}
        onClose={() => setCredentialsModal({ ...credentialsModal, open: false })}
        loginId={credentialsModal.loginId}
        tempPassword={credentialsModal.tempPassword}
      />
    </div>
  );
}

