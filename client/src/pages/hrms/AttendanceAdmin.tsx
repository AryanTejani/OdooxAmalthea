import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTableLite, Column } from '@/components/ui-ext/DataTableLite';
import { KpiCard } from '@/components/ui-ext/KpiCard';
import { EmptyState } from '@/components/ui-ext/EmptyState';
import { ChevronLeft, ChevronRight, Users, Clock, TrendingUp } from 'lucide-react';
import { useWS } from '@/hooks/useWS';
import { useDebouncedValue } from '@/hooks/useDebounce';

export function AttendanceAdmin() {
  const { user } = useAuth();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);

  // Parse selected date
  const dateObj = useMemo(() => {
    return new Date(selectedDate + 'T00:00:00.000Z');
  }, [selectedDate]);

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Fetch attendance day data
  const { data: attendance, isLoading, refetch } = useQuery({
    queryKey: ['attendance-day', selectedDate, debouncedSearch],
    queryFn: () => hrmsApi.getAttendanceDay(selectedDate, debouncedSearch || undefined),
  });

  // Navigate to previous day
  const goToPreviousDay = () => {
    const prevDate = new Date(dateObj);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
    setSelectedDate(prevStr);
  };

  // Navigate to next day
  const goToNextDay = () => {
    const nextDate = new Date(dateObj);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
    setSelectedDate(nextStr);
  };

  // Navigate to today
  const goToToday = () => {
    setSelectedDate(todayStr);
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

  // Listen for real-time updates
  useWS({
    onMessage: (event) => {
      if (
        (event.table === 'activity_samples' || event.table === 'attendance') &&
        event.row
      ) {
        // Check if the update is for the selected date
        let eventDate: string | null = null;
        
        if (event.row.minute_start && (typeof event.row.minute_start === 'string' || event.row.minute_start instanceof Date || typeof event.row.minute_start === 'number')) {
          eventDate = new Date(event.row.minute_start).toISOString().split('T')[0];
        } else if (event.row.day && (typeof event.row.day === 'string' || event.row.day instanceof Date || typeof event.row.day === 'number')) {
          eventDate = new Date(event.row.day).toISOString().split('T')[0];
        }

        if (eventDate === selectedDate) {
          // Refetch data for the selected date
          refetch();
        }
      }
    },
  });

  // Calculate KPIs
  const presentCount = attendance?.filter(row => row.in_at !== null).length || 0;
  const totalEmployees = attendance?.length || 0;
  const avgWorkHours = attendance && attendance.length > 0
    ? (attendance.reduce((sum, row) => sum + row.work_hours, 0) / attendance.length).toFixed(2)
    : '0.00';
  const totalExtraHours = attendance?.reduce((sum, row) => sum + row.extra_hours, 0).toFixed(2) || '0.00';

  // Define columns for DataTableLite
  type AttendanceRow = {
    employee_id: string;
    name: string;
    login_id: string | null;
    in_at: string | null;
    out_at: string | null;
    work_hours: number;
    extra_hours: number;
  };

  const columns: Column<AttendanceRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.login_id && (
            <div className="text-xs text-muted-foreground">{row.login_id}</div>
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
            <h1 className="text-2xl font-semibold">Attendance Overview</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View attendance for all employees by date
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousDay}
              disabled={isLoading}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
              disabled={isLoading}
              aria-label="Select date"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextDay}
              disabled={isLoading}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              disabled={isLoading || selectedDate === todayStr}
              aria-label="Go to today"
            >
              Today
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        {attendance && attendance.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              label="Present"
              value={presentCount}
              icon={<Users className="h-5 w-5" />}
              helpText={`Out of ${totalEmployees} employees`}
            />
            <KpiCard
              label="Total Employees"
              value={totalEmployees}
              icon={<Users className="h-5 w-5" />}
              helpText="Employees tracked"
            />
            <KpiCard
              label="Avg Work Hours"
              value={`${avgWorkHours}h`}
              icon={<Clock className="h-5 w-5" />}
              helpText="Average hours worked"
            />
            <KpiCard
              label="Total Extra Hours"
              value={`${totalExtraHours}h`}
              icon={<TrendingUp className="h-5 w-5" />}
              helpText="Total overtime hours"
            />
          </div>
        )}

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle>{formatDate(dateObj)}</CardTitle>
            <CardDescription>Employee attendance for the selected date</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTableLite
              data={attendance || []}
              columns={columns}
              isLoading={isLoading}
              searchKey={(item) => `${item.name} ${item.login_id || ''}`}
              searchPlaceholder="Search employees..."
              emptyState={{
                icon: <Users className="h-12 w-12 text-muted-foreground" />,
                title: 'No attendance records',
                subtitle: debouncedSearch
                  ? 'No employees found matching your search'
                  : 'No attendance records found for this day.',
              }}
            />
          </CardContent>
        </Card>
      </div>
  );
}

