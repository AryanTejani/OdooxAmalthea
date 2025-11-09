import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hrmsApi, getErrorMessage, Payrun } from '@/lib/api';
import { DataTableLite, Column } from '@/components/ui-ext/DataTableLite';
import { StatusBadge } from '@/components/ui-ext/StatusBadge';
import { Plus, Play, CheckCircle, XCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';

export function PayrunList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newPayrunOpen, setNewPayrunOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: payruns, isLoading } = useQuery({
    queryKey: ['payroll', 'payruns'],
    queryFn: () => hrmsApi.getPayruns(),
  });

  const createMutation = useMutation({
    mutationFn: (month: string) => hrmsApi.createPayrun({ month }),
    onSuccess: (payrun) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns'] });
      toast.success(`Payrun created for ${payrun.month}`);
      setNewPayrunOpen(false);
      navigate(`/hrms/payroll/payruns/${payrun.id}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const computeMutation = useMutation({
    mutationFn: (payrunId: string) => hrmsApi.computePayrun(payrunId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns'] });
      toast.success(`Computed ${result.processedCount} payslips`);
      if (result.warnings.length > 0) {
        toast.warning(`${result.warnings.length} warnings encountered`);
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const validateMutation = useMutation({
    mutationFn: (payrunId: string) => hrmsApi.validatePayrun(payrunId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns'] });
      toast.success('Payrun validated successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (payrunId: string) => hrmsApi.cancelPayrun(payrunId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns'] });
      toast.success('Payrun cancelled');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleCreatePayrun = () => {
    if (!selectedMonth) {
      toast.error('Please select a month');
      return;
    }
    createMutation.mutate(selectedMonth);
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'compute' | 'validate' | 'cancel' | null;
    payrunId: string | null;
    payrunMonth?: string;
  }>({
    open: false,
    type: null,
    payrunId: null,
  });

  const handleCompute = (payrunId: string, payrunMonth: string) => {
    setConfirmDialog({
      open: true,
      type: 'compute',
      payrunId,
      payrunMonth,
    });
  };

  const handleValidate = (payrunId: string, payrunMonth: string) => {
    setConfirmDialog({
      open: true,
      type: 'validate',
      payrunId,
      payrunMonth,
    });
  };

  const handleCancel = (payrunId: string, payrunMonth: string) => {
    setConfirmDialog({
      open: true,
      type: 'cancel',
      payrunId,
      payrunMonth,
    });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.payrunId || !confirmDialog.type) return;

    switch (confirmDialog.type) {
      case 'compute':
        computeMutation.mutate(confirmDialog.payrunId);
        break;
      case 'validate':
        validateMutation.mutate(confirmDialog.payrunId);
        break;
      case 'cancel':
        cancelMutation.mutate(confirmDialog.payrunId);
        break;
    }
    setConfirmDialog({ open: false, type: null, payrunId: null });
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Define columns for DataTableLite
  const columns: Column<Payrun>[] = [
    {
      key: 'month',
      header: 'Month',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.month}</div>
          <div className="text-xs text-muted-foreground">
            {row.payslipsCount || row.employeesCount || 0} payslips
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const statusMap: Record<string, 'draft' | 'computed' | 'validated' | 'paid' | 'cancelled'> = {
          'draft': 'draft',
          'computed': 'computed',
          'validated': 'validated',
          'paid': 'paid',
          'cancelled': 'cancelled',
        };
        return <StatusBadge status={statusMap[row.status] || 'neutral'}>{row.status.toUpperCase()}</StatusBadge>;
      },
    },
    {
      key: 'netTotal',
      header: 'Net Total',
      cell: (row) => (
        <span className="font-medium">{formatCurrency(row.netTotal || 0)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          {(row.status === 'draft' || row.status === 'computed') && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleCompute(row.id, row.month);
              }}
              disabled={computeMutation.isPending}
              aria-label="Compute payrun"
            >
              <Play className="h-4 w-4 mr-1" />
              Compute
            </Button>
          )}
          {row.status === 'computed' && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleValidate(row.id, row.month);
              }}
              disabled={validateMutation.isPending}
              aria-label="Validate payrun"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Validate
            </Button>
          )}
          {(row.status === 'draft' || row.status === 'computed') && (
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel(row.id, row.month);
              }}
              disabled={cancelMutation.isPending}
              aria-label="Cancel payrun"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Payruns</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage payroll runs and payslips
            </p>
          </div>
          <Button onClick={() => setNewPayrunOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Payrun
          </Button>
        </div>

        <DataTableLite
          data={payruns || []}
          columns={columns}
          isLoading={isLoading}
          searchKey={(item) => `${item.month} ${item.status}`}
          searchPlaceholder="Search payruns by month or status..."
          emptyState={{
            icon: <FileText className="h-12 w-12 text-muted-foreground" />,
            title: 'No payruns found',
            subtitle: 'Create your first payrun to get started.',
            action: {
              label: 'Create Payrun',
              onClick: () => setNewPayrunOpen(true),
            },
          }}
          onRowClick={(row) => navigate(`/hrms/payroll/payruns/${row.id}`)}
        />

      {/* New Payrun Dialog */}
      <Dialog open={newPayrunOpen} onOpenChange={setNewPayrunOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Payrun</DialogTitle>
            <DialogDescription>Generate a new payroll run for the selected month</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="month">Select Month</Label>
              <Input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={createMutation.isPending}
                aria-label="Select month for payrun"
              />
              <p className="text-sm text-muted-foreground">
                Select the month for which you want to generate the payrun
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewPayrunOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreatePayrun}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Payrun'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.type === 'compute' && 'Compute Payrun'}
              {confirmDialog.type === 'validate' && 'Validate Payrun'}
              {confirmDialog.type === 'cancel' && 'Cancel Payrun'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.type === 'compute' && `Are you sure you want to compute payslips for ${confirmDialog.payrunMonth}?`}
              {confirmDialog.type === 'validate' && `Are you sure you want to validate the payrun for ${confirmDialog.payrunMonth}? This will mark it as validated and lock the payslips.`}
              {confirmDialog.type === 'cancel' && `Are you sure you want to cancel the payrun for ${confirmDialog.payrunMonth}? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, type: null, payrunId: null })}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirmDialog.type === 'cancel' ? 'destructive' : 'default'}
              onClick={handleConfirmAction}
              disabled={computeMutation.isPending || validateMutation.isPending || cancelMutation.isPending}
            >
              {confirmDialog.type === 'compute' && (computeMutation.isPending ? 'Computing...' : 'Compute')}
              {confirmDialog.type === 'validate' && (validateMutation.isPending ? 'Validating...' : 'Validate')}
              {confirmDialog.type === 'cancel' && (cancelMutation.isPending ? 'Cancelling...' : 'Cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

