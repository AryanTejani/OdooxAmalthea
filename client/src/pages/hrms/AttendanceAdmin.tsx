import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="mt-2 text-sm text-gray-600">
            View attendance for all employees
          </p>
        </div>
      </div>

      {/* Search and Date Navigation */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or login ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousDay}
                disabled={isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
                disabled={isLoading}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextDay}
                disabled={isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                disabled={isLoading}
              >
                Day
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {formatDate(dateObj)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !attendance || attendance.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {debouncedSearch
                  ? 'No employees found matching your search'
                  : 'No attendance records for this day'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead className="text-right">Work Hours</TableHead>
                    <TableHead className="text-right">Extra Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((row) => (
                    <TableRow key={row.employee_id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{row.name}</div>
                          {row.login_id && (
                            <div className="text-sm text-muted-foreground">
                              {row.login_id}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatTime(row.in_at)}</TableCell>
                      <TableCell>{formatTime(row.out_at)}</TableCell>
                      <TableCell className="text-right">{formatHours(row.work_hours)}</TableCell>
                      <TableCell className="text-right">{formatHours(row.extra_hours)}</TableCell>
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

