import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hrmsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableLite, Column } from '@/components/ui-ext/DataTableLite';
import { KpiCard } from '@/components/ui-ext/KpiCard';
import { StatusBadge } from '@/components/ui-ext/StatusBadge';
import { EmptyState } from '@/components/ui-ext/EmptyState';
import { ChevronLeft, ChevronRight, Calendar, Clock, DollarSign, CheckCircle } from 'lucide-react';
import { useWS } from '@/hooks/useWS';

export function AttendanceMe() {
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Parse selected month
  const [year, month] = useMemo(() => {
    return selectedMonth.split('-').map(Number);
  }, [selectedMonth]);

  // Fetch attendance data
  const { data: attendance, isLoading, refetch } = useQuery({
    queryKey: ['attendance-me', selectedMonth],
    queryFn: () => hrmsApi.getAttendanceMe(selectedMonth),
  });

  // Navigate to previous month
  const goToPreviousMonth = () => {
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);
    const newMonthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
  };

  // Navigate to next month
  const goToNextMonth = () => {
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + 1);
    const newMonthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
  };

  // Format time to HH:MM
  const formatTime = (isoString: string | null): string => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '-';
    }
  };

  // Format hours to decimal (e.g., 0.46)
  const formatHours = (hours: number): string => {
    return hours.toFixed(2);
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00.000Z');
    return date.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Get month name
  const getMonthName = (): string => {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Check if selected month is current month
  const isCurrentMonth = selectedMonth === currentMonthStr;
  const todayStr = today.toISOString().split('T')[0];

  // Listen for real-time updates
  useWS({
    onMessage: (event) => {
      if (
        (event.table === 'activity_samples' || event.table === 'attendance') &&
        event.row &&
        isCurrentMonth
      ) {
        // Check if the update is for today
        let eventDate: string | null = null;
        
        if (event.row.minute_start && (typeof event.row.minute_start === 'string' || event.row.minute_start instanceof Date || typeof event.row.minute_start === 'number')) {
          eventDate = new Date(event.row.minute_start).toISOString().split('T')[0];
        } else if (event.row.day && (typeof event.row.day === 'string' || event.row.day instanceof Date || typeof event.row.day === 'number')) {
          eventDate = new Date(event.row.day).toISOString().split('T')[0];
        }

        if (eventDate === todayStr) {
          // Refetch data
          refetch();
        }
      }
    },
  });

  // Define columns for DataTableLite
  type AttendanceDay = {
    date: string;
    in_at: string | null;
    out_at: string | null;
    work_hours: number;
    extra_hours: number;
    leave_type: string | null;
    payable: boolean;
  };

  const columns: Column<AttendanceDay>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span>{formatDate(row.date)}</span>
          {row.leave_type && (() => {
            // Map leave types to valid status variants
            const leaveTypeMap: Record<string, 'leave' | 'info' | 'warn'> = {
              'casual': 'leave',
              'sick': 'info',
              'unpaid': 'warn',
            };
            const status = leaveTypeMap[row.leave_type.toLowerCase()] || 'leave';
            return <StatusBadge status={status}>{row.leave_type}</StatusBadge>;
          })()}
          {!row.payable && row.work_hours > 0 && (
            <StatusBadge status="danger" className="text-xs">Not Payable</StatusBadge>
          )}
        </div>
      ),
    },
    {
      key: 'in_at',
      header: 'Check In',
      cell: (row) => <span>{formatTime(row.in_at)}</span>,
    },
    {
      key: 'out_at',
      header: 'Check Out',
      cell: (row) => <span>{formatTime(row.out_at)}</span>,
    },
    {
      key: 'work_hours',
      header: 'Work Hours',
      cell: (row) => (
        <div className="text-right" title="Computed from activity tracker">
          {formatHours(row.work_hours)}h
        </div>
      ),
    },
    {
      key: 'extra_hours',
      header: 'Extra Hours',
      cell: (row) => (
        <div className="text-right" title="Computed from activity tracker">
          {formatHours(row.extra_hours)}h
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
        {/* Header with Date Picker */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">My Attendance</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View your attendance for the selected month
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              disabled={isLoading}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={isLoading}
              className="w-40"
              aria-label="Select month"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              disabled={isLoading || isCurrentMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        {attendance && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              label="Present Days"
              value={attendance.kpi.present_days || 0}
              icon={<CheckCircle className="h-5 w-5" />}
              helpText="Days marked as present"
            />
            <KpiCard
              label="Paid Leave"
              value={attendance.kpi.leave_days || 0}
              icon={<Calendar className="h-5 w-5" />}
              helpText="Leave days taken"
            />
            <KpiCard
              label="Working Days"
              value={attendance.kpi.total_working_days || 0}
              icon={<Clock className="h-5 w-5" />}
              helpText="Total working days in month"
            />
            <KpiCard
              label="Payable Days"
              value={attendance.kpi.payable_days || 0}
              icon={<DollarSign className="h-5 w-5" />}
              helpText="Days eligible for payment"
            />
          </div>
        )}

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle>{getMonthName()}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : !attendance || attendance.days.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-12 w-12 text-muted-foreground" />}
                title="No attendance records"
                subtitle="No attendance records found for this month."
              />
            ) : (
              <DataTableLite
                data={attendance.days}
                columns={columns}
                isLoading={false}
                searchKey={(item) => `${item.date} ${item.leave_type || ''}`}
                searchPlaceholder="Search by date or leave type..."
                emptyState={{
                  icon: <Calendar className="h-12 w-12 text-muted-foreground" />,
                  title: 'No attendance records',
                  subtitle: 'No records found for the selected month.',
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
  );
}

