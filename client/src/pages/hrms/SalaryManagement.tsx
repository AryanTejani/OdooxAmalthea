import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { hrmsApi, getErrorMessage, SalaryConfig, EmployeeWithoutSalary } from '@/lib/api';
import { Plus, Pencil, Trash2, IndianRupee, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';

interface SalaryFormData {
  employeeId: string;
  basic: number;
  hra?: number;
  transport?: number;
  special?: number;
}

export function SalaryManagement() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);

  const { data: salaryConfigs, isLoading: loadingConfigs } = useQuery({
    queryKey: ['salary', 'configs'],
    queryFn: () => hrmsApi.getSalaryConfigs(),
  });

  const { data: employeesWithoutSalary } = useQuery({
    queryKey: ['salary', 'employees-without'],
    queryFn: () => hrmsApi.getEmployeesWithoutSalary(),
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<SalaryFormData>();

  const createMutation = useMutation({
    mutationFn: (data: { employeeId: string; basic: number; allowances?: Record<string, number> }) =>
      hrmsApi.createSalaryConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      toast.success('Salary configuration created');
      setDialogOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ employeeId, data }: { employeeId: string; data: { basic: number; allowances?: Record<string, number> } }) =>
      hrmsApi.updateSalaryConfig(employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      toast.success('Salary configuration updated');
      setDialogOpen(false);
      setEditingEmployee(null);
      reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (employeeId: string) => hrmsApi.deleteSalaryConfig(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      toast.success('Salary configuration deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const onSubmit = (formData: SalaryFormData) => {
    const allowances: Record<string, number> = {};
    if (formData.hra) allowances.HRA = formData.hra;
    if (formData.transport) allowances.Transport = formData.transport;
    if (formData.special) allowances.Special = formData.special;

    const payload = {
      employeeId: formData.employeeId,
      basic: formData.basic,
      allowances: Object.keys(allowances).length > 0 ? allowances : undefined,
    };

    if (editingEmployee) {
      updateMutation.mutate({ employeeId: editingEmployee, data: { basic: formData.basic, allowances } });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (config: SalaryConfig) => {
    setEditingEmployee(config.employeeId);
    setValue('employeeId', config.employeeId);
    setValue('basic', config.basic);
    setValue('hra', config.allowances?.HRA || 0);
    setValue('transport', config.allowances?.Transport || 0);
    setValue('special', config.allowances?.Special || 0);
    setDialogOpen(true);
  };

  const handleDelete = (employeeId: string) => {
    if (confirm('Are you sure you want to delete this salary configuration?')) {
      deleteMutation.mutate(employeeId);
    }
  };

  const handleAddNew = () => {
    reset();
    setEditingEmployee(null);
    setDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateMonthlyWage = (config: SalaryConfig) => {
    const allowancesTotal = Object.values(config.allowances || {}).reduce((sum, val) => sum + val, 0);
    return config.basic + allowancesTotal;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Salary Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage employee salary structures for payroll processing
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Salary Config
        </Button>
      </div>

      {/* Warning for employees without salary */}
      {employeesWithoutSalary && employeesWithoutSalary.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              {employeesWithoutSalary.length} Employee(s) Without Salary Configuration
            </CardTitle>
            <CardDescription className="text-yellow-700">
              These employees will be excluded from payroll processing until salary is configured.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {employeesWithoutSalary.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {emp.code} • {emp.title || 'No title'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setValue('employeeId', emp.id);
                      setEditingEmployee(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Salary
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Salary Configurations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Salary Configurations</CardTitle>
          <CardDescription>
            Current salary structures for all employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConfigs ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : salaryConfigs && salaryConfigs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Allowances</TableHead>
                  <TableHead className="text-right">Monthly Wage</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryConfigs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{config.employeeName}</p>
                        <p className="text-sm text-muted-foreground">{config.employeeTitle || 'No title'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{config.employeeCode}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(config.basic)}
                    </TableCell>
                    <TableCell className="text-right">
                      {Object.keys(config.allowances || {}).length > 0 ? (
                        <div className="flex flex-col items-end gap-1">
                          {Object.entries(config.allowances).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key}: {formatCurrency(value)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(calculateMonthlyWage(config))}
                    </TableCell>
                    <TableCell>
                      {new Date(config.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(config)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(config.employeeId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No salary configurations found. Add one to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Edit Salary Configuration' : 'Add Salary Configuration'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!editingEmployee && (
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee *</Label>
                <select
                  id="employeeId"
                  {...register('employeeId', { required: 'Please select an employee' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select employee...</option>
                  {employeesWithoutSalary?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code})
                    </option>
                  ))}
                </select>
                {errors.employeeId && (
                  <p className="text-sm text-destructive">{errors.employeeId.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="basic">Basic Salary (₹) *</Label>
              <Input
                id="basic"
                type="number"
                {...register('basic', {
                  required: 'Basic salary is required',
                  min: { value: 1, message: 'Basic salary must be positive' },
                  valueAsNumber: true,
                })}
                placeholder="e.g., 25000"
              />
              {errors.basic && (
                <p className="text-sm text-destructive">{errors.basic.message}</p>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Allowances (Optional)</h3>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="hra">HRA (₹)</Label>
                  <Input
                    id="hra"
                    type="number"
                    {...register('hra', { valueAsNumber: true })}
                    placeholder="e.g., 10000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transport">Transport Allowance (₹)</Label>
                  <Input
                    id="transport"
                    type="number"
                    {...register('transport', { valueAsNumber: true })}
                    placeholder="e.g., 2000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="special">Special Allowance (₹)</Label>
                  <Input
                    id="special"
                    type="number"
                    {...register('special', { valueAsNumber: true })}
                    placeholder="e.g., 5000"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingEmployee(null);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editingEmployee
                  ? 'Update Salary'
                  : 'Create Salary'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

