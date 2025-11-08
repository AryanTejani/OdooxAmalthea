import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hrmsApi } from '@/lib/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { 
  Users, Calendar, Clock, DollarSign, TrendingUp, AlertCircle, 
  CheckCircle, XCircle, FileText, Timer, IndianRupee 
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: dashboardStats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => hrmsApi.getDashboardStats(),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <p className="text-center text-muted-foreground py-8">Loading dashboard...</p>
      </div>
    );
  }

  // Admin/HR/Payroll Dashboard
  if (dashboardStats?.role === 'admin') {
    const { kpis, charts } = dashboardStats;
    
    // Prepare attendance trend chart data
    const attendanceTrendData = charts.attendanceTrend.map((item: any) => ({
      day: formatDate(item.date),
      present: item.present,
    }));

    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your organization's HRMS metrics
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present Today</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.presentToday || 0}</div>
              <p className="text-xs text-muted-foreground">
                out of {kpis.totalEmployees || 0} employees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Leave Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.onLeaveToday || 0}</div>
              <p className="text-xs text-muted-foreground">Employees on leave</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.pendingLeaves || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalEmployees || 0}</div>
              <p className="text-xs text-muted-foreground">Active employees</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Payrun</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {kpis.currentPayrun ? (
                <>
                  <Badge variant={kpis.currentPayrun.status === 'done' ? 'default' : 'secondary'} className="mb-2">
                    {kpis.currentPayrun.status.toUpperCase()}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {kpis.currentPayrun.employeesCount} employees
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">No payrun this month</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trend (Last 7 Days)</CardTitle>
              <CardDescription>Number of employees present each day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={attendanceTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="present" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave Types (Last 30 Days)</CardTitle>
              <CardDescription>Breakdown of approved leaves</CardDescription>
            </CardHeader>
            <CardContent>
              {charts.leaveTypes && charts.leaveTypes.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={charts.leaveTypes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {charts.leaveTypes.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-20">No leave data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/hrms/employees')}>
            <CardHeader>
              <CardTitle className="text-lg">View Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Manage employee directory</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/hrms/leave/approvals')}>
            <CardHeader>
              <CardTitle className="text-lg">Review Leaves</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {kpis.pendingLeaves || 0} pending approvals
              </p>
            </CardContent>
          </Card>

          {(user?.role === 'admin' || user?.role === 'payroll') && (
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/hrms/payroll')}>
              <CardHeader>
                <CardTitle className="text-lg">Payroll</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Manage payroll runs</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Employee Dashboard
  if (dashboardStats?.role === 'employee') {
    const { kpis, charts } = dashboardStats;
    
    // Prepare last 7 days chart data
    const last7DaysData = charts.last7Days.map((item: any) => ({
      date: formatDate(item.date),
      status: item.status === 'PRESENT' ? 1 : 0,
      label: item.status || 'ABSENT',
    }));

    const statusColor = kpis.todayStatus === 'PRESENT' ? 'text-green-600' : 
                        kpis.todayStatus === 'LEAVE' ? 'text-blue-600' : 
                        'text-gray-600';
    const statusIcon = kpis.todayStatus === 'PRESENT' ? CheckCircle : 
                       kpis.todayStatus === 'LEAVE' ? Calendar : 
                       XCircle;

    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your attendance, leaves, and payslips
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Status</CardTitle>
              {statusIcon === CheckCircle && <CheckCircle className={`h-4 w-4 ${statusColor}`} />}
              {statusIcon === Calendar && <Calendar className={`h-4 w-4 ${statusColor}`} />}
              {statusIcon === XCircle && <XCircle className={`h-4 w-4 ${statusColor}`} />}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${statusColor}`}>
                {kpis.todayStatus || 'ABSENT'}
              </div>
              {kpis.isTimerActive && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  Timer active
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpis.presentDays || 0} / {kpis.totalDays || 0}
              </div>
              <p className="text-xs text-muted-foreground">Days present</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.pendingLeaves || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Payslip</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {kpis.lastPayslip ? (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(kpis.lastPayslip.net)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(kpis.lastPayslip.periodMonth).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">No payslip yet</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Attendance (Last 7 Days)</CardTitle>
              <CardDescription>Your attendance status</CardDescription>
            </CardHeader>
            <CardContent>
              {last7DaysData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={last7DaysData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 1]} ticks={[0, 1]} />
                    <Tooltip />
                    <Bar dataKey="status" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-20">No attendance data</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave Balance (This Year)</CardTitle>
              <CardDescription>Leaves used by type</CardDescription>
            </CardHeader>
            <CardContent>
              {charts.leaveBalance && charts.leaveBalance.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={charts.leaveBalance}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ type, used }) => `${type}: ${used}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="used"
                    >
                      {charts.leaveBalance.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-20">No leave data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/hrms/attendance/me')}>
            <CardHeader>
              <CardTitle className="text-lg">View Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Check your attendance records</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/hrms/leave')}>
            <CardHeader>
              <CardTitle className="text-lg">Apply for Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Request time off</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/hrms/my/payslips')}>
            <CardHeader>
              <CardTitle className="text-lg">My Payslips</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View your payslips</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Fallback for unknown role or no data
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">No dashboard data available</p>
        </CardContent>
      </Card>
    </div>
  );
}
