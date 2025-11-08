import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hrmsApi, getErrorMessage, PayrunStatus } from '@/lib/api';
import { PayslipTable } from '@/components/hrms/PayslipTable';
import { ArrowLeft, Play, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const statusVariants: Record<PayrunStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  computed: 'secondary',
  validated: 'default',
  done: 'default',
  cancelled: 'destructive',
};

export function PayrunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: payslips, isLoading } = useQuery({
    queryKey: ['payroll', 'payruns', id, 'payslips'],
    queryFn: () => hrmsApi.getPayslipsByPayrunId(id!),
    enabled: !!id,
  });

  const { data: payruns } = useQuery({
    queryKey: ['payroll', 'payruns'],
    queryFn: () => hrmsApi.getPayruns(),
  });

  const payrun = payruns?.find((p) => p.id === id);

  const computeMutation = useMutation({
    mutationFn: () => hrmsApi.computePayrun(id!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns', id, 'payslips'] });
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
    mutationFn: () => hrmsApi.validatePayrun(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns', id, 'payslips'] });
      toast.success('Payrun validated successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => hrmsApi.cancelPayrun(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns', id, 'payslips'] });
      toast.success('Payrun cancelled');
      navigate('/hrms/payroll/payruns');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const recomputeMutation = useMutation({
    mutationFn: (payslipId: string) => hrmsApi.recomputePayslip(payslipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payruns', id, 'payslips'] });
      toast.success('Payslip recomputed');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (!payrun && !isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Button variant="ghost" onClick={() => navigate('/hrms/payroll/payruns')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Payruns
        </Button>
        <p className="text-center text-muted-foreground py-8">Payrun not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Button variant="ghost" onClick={() => navigate('/hrms/payroll/payruns')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Payruns
      </Button>

      {payrun && (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{formatMonth(payrun.month)}</h1>
            <p className="text-muted-foreground mt-1">
              Payrun Details • {payrun.employeesCount || payslips?.length || 0} employees
            </p>
          </div>
          <Badge variant={statusVariants[payrun.status]}>
            {payrun.status.toUpperCase()}
          </Badge>
        </div>
      )}

      {payrun && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Gross Total</p>
                <p className="text-2xl font-bold">{formatCurrency(payrun.grossTotal)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Total</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(payrun.netTotal)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employee Count</p>
                <p className="text-2xl font-bold">{payrun.employeesCount || payslips?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {payrun && (
        <div className="flex gap-2">
          {(payrun.status === 'draft' || payrun.status === 'computed') && (
            <Button
              onClick={() => {
                if (confirm('Compute payslips for this payrun?')) {
                  computeMutation.mutate();
                }
              }}
              disabled={computeMutation.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {computeMutation.isPending ? 'Computing...' : 'Compute Payslips'}
            </Button>
          )}
          {payrun.status === 'computed' && (
            <Button
              onClick={() => {
                if (confirm('Validate this payrun? This will mark it as done and lock the payslips.')) {
                  validateMutation.mutate();
                }
              }}
              disabled={validateMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {validateMutation.isPending ? 'Validating...' : 'Validate'}
            </Button>
          )}
          {(payrun.status === 'draft' || payrun.status === 'computed') && (
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm('Cancel this payrun? This action cannot be undone.')) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Payrun'}
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : payslips && payslips.length > 0 ? (
            <PayslipTable
              payslips={payslips}
              onRowClick={(payslip) => navigate(`/hrms/payroll/payslips/${payslip.id}`)}
              showActions={payrun?.status !== 'done'}
              onRecompute={(payslipId) => {
                if (confirm('Recompute this payslip?')) {
                  recomputeMutation.mutate(payslipId);
                }
              }}
            />
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No payslips found. Click "Compute Payslips" to generate them.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
