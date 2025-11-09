import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KpiCard } from '@/components/ui-ext/KpiCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, DollarSign, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { hrmsApi } from '@/lib/api';
import { EmptyState } from '@/components/ui-ext/EmptyState';

export function Reports() {
  // Fetch reports data (monthly stats, average salary, total cost)
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['reports', 'data'],
    queryFn: () => hrmsApi.getReportsData(),
  });

  // Fetch employee count
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['reports', 'employees'],
    queryFn: () => hrmsApi.getEmployeesGrid(),
  });

  // Extract data from reportsData
  const monthlyStats = reportsData?.monthlyStats;
  const employerCostData = monthlyStats?.employerCost || [];
  const employeeCountData = monthlyStats?.employeeCount || [];
  
  // Calculate totals and averages
  const totalEmployees = employees?.length || 0;
  const totalCost = reportsData?.totalCost || 0;
  const avgSalary = reportsData?.avgSalary || null;
  
  // Calculate attendance rate (mock for now - can be enhanced with real API)
  const attendanceRate = 0; // Placeholder - would need attendance API

  const isLoading = reportsLoading || employeesLoading;

  // Combine chart data - match by month name
  const chartData = employerCostData.map((costItem) => {
    const countItem = employeeCountData.find(item => item.month === costItem.month);
    return {
      month: costItem.month,
      employees: countItem?.count || 0,
      cost: costItem.cost || 0,
    };
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View analytics and insights
        </p>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            label="Total Employees"
            value={totalEmployees}
            icon={<Users className="h-5 w-5" />}
            helpText="Current employee count"
          />
          <KpiCard
            label="Total Cost"
            value={formatCurrency(totalCost)}
            icon={<DollarSign className="h-5 w-5" />}
            helpText="Latest monthly payroll cost"
          />
          <KpiCard
            label="Average Salary"
            value={avgSalary !== null && avgSalary > 0 ? formatCurrency(avgSalary) : 'N/A'}
            icon={<TrendingUp className="h-5 w-5" />}
            helpText="Average monthly salary"
          />
          <KpiCard
            label="Attendance Rate"
            value={attendanceRate > 0 ? `${attendanceRate}%` : 'N/A'}
            icon={<Calendar className="h-5 w-5" />}
            helpText="Monthly attendance rate"
          />
        </div>
      )}

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Employee and Cost Trends</CardTitle>
          <CardDescription>Monthly trends over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'cost' || name === 'Cost (₹)') {
                      return formatCurrency(value);
                    }
                    return value;
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="employees" fill="#8884d8" name="Employees" />
                <Bar yAxisId="right" dataKey="cost" fill="#82ca9d" name="Cost (₹)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={<TrendingUp className="h-12 w-12 text-muted-foreground" />}
              title="No data available"
              subtitle="Chart data will appear here once payruns are created."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

