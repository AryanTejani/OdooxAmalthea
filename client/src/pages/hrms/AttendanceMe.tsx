import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hrmsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
        const eventDate = event.row.minute_start
          ? new Date(event.row.minute_start).toISOString().split('T')[0]
          : event.row.day
          ? new Date(event.row.day).toISOString().split('T')[0]
          : null;

        if (eventDate === todayStr) {
          // Refetch data
          refetch();
        }
      }
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="mt-2 text-sm text-gray-600">
            View your attendance for the selected month
          </p>
        </div>
      </div>

      {/* Month Navigation and KPI Chips */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousMonth}
                disabled={isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border rounded-md"
                disabled={isLoading}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date(today.getFullYear(), i, 1);
                  const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  return (
                    <option key={monthStr} value={monthStr}>
                      {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </option>
                  );
                })}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextMonth}
                disabled={isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {attendance && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" className="px-3 py-1">
                  Present: {attendance.kpi.present_days}
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  Leaves: {attendance.kpi.leave_days}
                </Badge>
                <Badge variant="outline" className="px-3 py-1">
                  Working Days: {attendance.kpi.total_working_days}
                </Badge>
                <Badge variant="outline" className="px-3 py-1">
                  Payable: {attendance.kpi.payable_days}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>{getMonthName()}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !attendance || attendance.days.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No attendance records for this month</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead className="text-right">Work Hours</TableHead>
                    <TableHead className="text-right">Extra Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.days.map((day) => (
                      <TableRow key={day.date} title="Computed from activity tracker">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {formatDate(day.date)}
                            {day.leave_type && (
                              <Badge variant="secondary" className="text-xs">
                                {day.leave_type}
                              </Badge>
                            )}
                            {!day.payable && day.work_hours > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                Not Payable
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatTime(day.in_at)}</TableCell>
                        <TableCell>{formatTime(day.out_at)}</TableCell>
                        <TableCell className="text-right">{formatHours(day.work_hours)}</TableCell>
                        <TableCell className="text-right">{formatHours(day.extra_hours)}</TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

