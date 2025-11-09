import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hrmsApi } from '@/lib/api';
import { PayrunCard } from '@/components/hrms/PayrunCard';
import { AlertTriangle, Users, IndianRupee, TrendingUp, ArrowRight, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { EmptyState } from '@/components/ui-ext/EmptyState';
import { CheckCircle } from 'lucide-react';

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

  const warningCount = (warnings?.employeesWithoutBankAccount.count || 0) + (warnings?.employeesWithoutManager.count || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payroll Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
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
                  {warningCount > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
                      {warningCount}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>Items requiring attention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {warnings?.employeesWithoutBankAccount.count ? (
                  <div 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => navigate('/hrms/employees?filter=no_bank')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate('/hrms/employees?filter=no_bank');
                      }
                    }}
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
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-yellow-600">
                        {warnings.employeesWithoutBankAccount.count}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                ) : null}

                {warnings?.employeesWithoutManager.count ? (
                  <div 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => navigate('/hrms/employees?filter=no_manager')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate('/hrms/employees?filter=no_manager');
                      }
                    }}
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
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-yellow-600">
                        {warnings.employeesWithoutManager.count}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                ) : null}

                {warningCount === 0 && (
                  <EmptyState
                    icon={<CheckCircle className="h-12 w-12 text-green-500" />}
                    title="All good!"
                    subtitle="No warnings at this time."
                  />
                )}
              </CardContent>
            </Card>

          {/* Recent Payruns Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Payruns
              </CardTitle>
              <CardDescription>Latest payroll runs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentPayruns && recentPayruns.length > 0 ? (
                recentPayruns.map((payrun) => (
                  <PayrunCard
                    key={payrun.id}
                    payrun={payrun}
                    onClick={() => navigate(`/hrms/payroll/payruns/${payrun.id}`)}
                  />
                ))
              ) : (
                <EmptyState
                  icon={<FileText className="h-12 w-12 text-muted-foreground" />}
                  title="No payruns yet"
                  subtitle="Create your first payrun to get started."
                  action={{
                    label: 'Create Payrun',
                    onClick: () => navigate('/hrms/payroll/payruns'),
                  }}
                />
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
                Employer Cost (Last 6 Months)
              </CardTitle>
              <CardDescription>
                Monthly employer cost trends (includes employee gross + PF employer contribution)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {employerCostData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={employerCostData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip
                      formatter={(value: number, _name: string, props: any) => {
                        // Find matching payrun for this month to get gross_total
                        const monthName = props.payload.month;
                        const matchingPayrun = recentPayruns?.find(p => {
                          const [year, monthNum] = p.month.split('-');
                          const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
                          const payrunMonthName = date.toLocaleDateString('en-US', { month: 'short' });
                          return payrunMonthName === monthName;
                        });
                        
                        if (matchingPayrun) {
                          const gross = matchingPayrun.grossTotal;
                          const pfEmployer = value - gross;
                          return [
                            <div key="tooltip" className="space-y-1 p-1">
                              <div className="font-semibold text-sm">Total: {formatCurrency(value)}</div>
                              <div className="text-xs border-t pt-1 mt-1 space-y-0.5">
                                <div>Employee Gross: {formatCurrency(gross)}</div>
                                <div>PF Employer (12%): {formatCurrency(pfEmployer)}</div>
                              </div>
                            </div>
                          ];
                        }
                        return formatCurrency(value);
                      }}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Bar dataKey="cost" fill="#8b5cf6" name="Cost" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={<TrendingUp className="h-12 w-12 text-muted-foreground" />}
                  title="No data available"
                  subtitle="Employer cost data will appear here once payruns are created."
                />
              )}
            </CardContent>
          </Card>

          {/* Employee Count Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employee Count (Last 6 Months)
              </CardTitle>
              <CardDescription>Monthly employee count trends</CardDescription>
            </CardHeader>
            <CardContent>
              {employeeCountData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={employeeCountData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" name="Employees" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={<Users className="h-12 w-12 text-muted-foreground" />}
                  title="No data available"
                  subtitle="Employee count data will appear here once payruns are created."
                />
              )}
            </CardContent>
          </Card>
          </div>
        </div>
    </div>
  );
}

