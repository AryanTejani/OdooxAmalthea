import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hrmsApi } from '@/lib/api';
import { PayrunCard } from '@/components/hrms/PayrunCard';
import { AlertTriangle, Users, IndianRupee, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function PayrollDashboard() {
  const navigate = useNavigate();

  const { data: warnings } = useQuery({
    queryKey: ['payroll', 'warnings'],
    queryFn: () => hrmsApi.getPayrollWarnings(),
  });

  const { data: recentPayruns } = useQuery({
    queryKey: ['payroll', 'payruns', 'recent'],
    queryFn: () => hrmsApi.getPayruns(2, 0),
  });

  const { data: monthlyStats } = useQuery({
    queryKey: ['payroll', 'stats'],
    queryFn: () => hrmsApi.getMonthlyStats(6),
  });

  const employerCostData = monthlyStats?.employerCost || [];
  const employeeCountData = monthlyStats?.employeeCount || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of payroll operations and warnings
          </p>
        </div>
        <Button onClick={() => navigate('/hrms/payroll/payruns')}>
          View All Payruns
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Warnings Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Warnings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div 
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate('/hrms/employees?filter=no_bank')}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Employees without Bank A/c</p>
                    <p className="text-sm text-muted-foreground">
                      Missing bank account details
                    </p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {warnings?.employeesWithoutBankAccount.count || 0}
                </div>
              </div>

              <div 
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate('/hrms/employees?filter=no_manager')}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Employees without Manager</p>
                    <p className="text-sm text-muted-foreground">
                      Missing manager assignment
                    </p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {warnings?.employeesWithoutManager.count || 0}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Payruns Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Payruns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentPayruns && recentPayruns.length > 0 ? (
                recentPayruns.map((payrun) => (
                  <PayrunCard
                    key={payrun.id}
                    payrun={payrun}
                    onClick={() => navigate(`/hrms/payroll/payruns/${payrun.id}`)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No payruns found
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Charts */}
        <div className="space-y-6">
          {/* Employer Cost Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5" />
                Employer Cost (Monthly)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={employerCostData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="cost" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Total employer cost including PF and other benefits
              </p>
            </CardContent>
          </Card>

          {/* Employee Count Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Employee Count (Monthly)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={employeeCountData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Number of active employees per month
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

