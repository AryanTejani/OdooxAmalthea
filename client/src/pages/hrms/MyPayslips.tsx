import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { hrmsApi, PayrunStatus } from '@/lib/api';
import { Calendar, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusVariants: Record<PayrunStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  computed: 'secondary',
  validated: 'default',
  done: 'default',
  cancelled: 'destructive',
};

export function MyPayslips() {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: payslips, isLoading } = useQuery({
    queryKey: ['payroll', 'my-payslips', selectedMonth],
    queryFn: () => hrmsApi.getMyPayslips(selectedMonth),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">My Payslips</h1>
        <p className="text-muted-foreground mt-1">
          View your payslips and salary details
        </p>
      </div>

      {/* Month Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="month">Filter by Month</Label>
              <Input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground pt-6">
              {payslips && payslips.length > 0 
                ? `${payslips.length} payslip${payslips.length > 1 ? 's' : ''} found`
                : 'No payslips found'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payslips List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      ) : payslips && payslips.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {payslips.map((payslip) => (
            <Card 
              key={payslip.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/hrms/payroll/payslips/${payslip.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatMonth(payslip.periodMonth)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Payslip for {formatMonth(payslip.periodMonth)}
                    </p>
                  </div>
                  <Badge variant={statusVariants[payslip.status]}>
                    {payslip.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Wage</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(payslip.monthlyWage)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payable Days</p>
                      <p className="text-lg font-semibold">
                        {payslip.payableDays} / {payslip.totalWorkingDays}
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Gross Pay</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(payslip.gross)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Net Pay</p>
                        <p className="text-xl font-bold text-blue-600">
                          {formatCurrency(payslip.net)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/hrms/payroll/payslips/${payslip.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/hrms/payroll/payslips/${payslip.id}`);
                        setTimeout(() => window.print(), 500);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">No Payslips Found</p>
              <p className="text-sm text-muted-foreground">
                {selectedMonth 
                  ? `No payslips available for ${formatMonth(selectedMonth + '-01')}`
                  : 'Select a month to view your payslips'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

