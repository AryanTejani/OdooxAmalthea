import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { PayrunCard } from '@/components/hrms/PayrunCard';
import { Plus, Play, CheckCircle, XCircle } from 'lucide-react';
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

  const handleCompute = (payrunId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Compute payslips for this payrun?')) {
      computeMutation.mutate(payrunId);
    }
  };

  const handleValidate = (payrunId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Validate this payrun? This will mark it as done and lock the payslips.')) {
      validateMutation.mutate(payrunId);
    }
  };

  const handleCancel = (payrunId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Cancel this payrun? This action cannot be undone.')) {
      cancelMutation.mutate(payrunId);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payruns</h1>
          <p className="text-muted-foreground mt-1">
            Manage payroll runs and payslips
          </p>
        </div>
        <Button onClick={() => setNewPayrunOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Payrun
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Payruns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : payruns && payruns.length > 0 ? (
            <div className="space-y-4">
              {payruns.map((payrun) => (
                <div key={payrun.id} className="relative">
                  <PayrunCard
                    payrun={payrun}
                    onClick={() => navigate(`/hrms/payroll/payruns/${payrun.id}`)}
                  />
                  <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {(payrun.status === 'draft' || payrun.status === 'computed') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleCompute(payrun.id, e)}
                        disabled={computeMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Compute
                      </Button>
                    )}
                    {payrun.status === 'computed' && (
                      <Button
                        size="sm"
                        onClick={(e) => handleValidate(payrun.id, e)}
                        disabled={validateMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Validate
                      </Button>
                    )}
                    {(payrun.status === 'draft' || payrun.status === 'computed') && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => handleCancel(payrun.id, e)}
                        disabled={cancelMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No payruns found. Create your first payrun to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* New Payrun Dialog */}
      <Dialog open={newPayrunOpen} onOpenChange={setNewPayrunOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Payrun</DialogTitle>
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
    </div>
  );
}

