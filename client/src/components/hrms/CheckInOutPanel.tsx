import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { useWS } from '@/hooks/useWS';

// Format elapsed time in HH:MM:SS format
function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Hook to calculate elapsed time from a start timestamp
function useElapsedTime(startTime: string | null | undefined, isActive: boolean): string {
  const [elapsed, setElapsed] = useState<string>('00:00:00');

  useEffect(() => {
    if (!startTime || !isActive) {
      setElapsed('00:00:00');
      return;
    }

    const updateElapsed = () => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const diff = now - start;
      setElapsed(formatElapsedTime(diff));
    };

    // Update immediately
    updateElapsed();

    // Update every second
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime, isActive]);

  return elapsed;
}

export function CheckInOutPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Get employee data
  const { data: employee } = useQuery({
    queryKey: ['employee', 'me'],
    queryFn: () => hrmsApi.getEmployeeByUserId(),
    enabled: !!user,
  });

  // Get today's attendance - fetch current month to ensure we get today's record
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const { data: attendance, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance', currentMonth],
    queryFn: () => hrmsApi.getMyAttendance(currentMonth),
    enabled: !!employee,
    select: (data) => {
      const today = new Date().toISOString().split('T')[0];
      // Find today's attendance record (day is a string in format YYYY-MM-DD or ISO datetime)
      return data.find((r) => {
        if (!r.day) return false;
        // day is a string, check if it starts with today's date
        const dayStr = String(r.day);
        return dayStr.startsWith(today);
      });
    },
  });

  // Subscribe to realtime attendance updates
  useWS({
    onMessage: (event) => {
      if (event.table === 'attendance' && event.op && event.row && employee) {
        const eventEmployeeId = event.row.employeeId;
        if (eventEmployeeId === employee.id) {
          queryClient.invalidateQueries({ queryKey: ['attendance'] });
          queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
        }
      }
    },
    filter: (event) => event.table === 'attendance',
  });

  const punchInMutation = useMutation({
    mutationFn: () => hrmsApi.punchIn(),
    onSuccess: async () => {
      // Invalidate and refetch all attendance queries
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      await queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
      // Refetch to get updated data immediately
      await queryClient.refetchQueries({ queryKey: ['attendance'] });
      await refetchAttendance();
      toast.success('Checked in successfully!');
      // Navigate to dashboard after successful check-in
      setTimeout(() => {
        navigate('/hrms/dashboard');
      }, 500);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      setIsCheckingIn(false);
    },
  });

  const punchOutMutation = useMutation({
    mutationFn: () => hrmsApi.punchOut(),
    onSuccess: async () => {
      // Invalidate and refetch all attendance queries
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      await queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
      // Refetch to get updated data immediately
      await queryClient.refetchQueries({ queryKey: ['attendance'] });
      await refetchAttendance();
      toast.success('Checked out successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      setIsCheckingOut(false);
    },
  });

  const handleCheckIn = () => {
    if (isCheckingIn || punchInMutation.isPending) return;
    setIsCheckingIn(true);
    punchInMutation.mutate();
  };

  const handleCheckOut = () => {
    if (isCheckingOut || punchOutMutation.isPending) return;
    setIsCheckingOut(true);
    punchOutMutation.mutate();
  };

  // Check if user is currently checked in (has inAt but no outAt)
  // Handle both string and Date object formats
  const hasCheckedIn = attendance?.inAt != null && attendance.inAt !== '';
  const hasCheckedOut = attendance?.outAt != null && attendance.outAt !== '';
  const isCheckedIn = hasCheckedIn && !hasCheckedOut;
  const isCheckedOut = hasCheckedIn && hasCheckedOut;

  // Calculate elapsed time (timer) when user is checked in
  const elapsedTime = useElapsedTime(attendance?.inAt || null, isCheckedIn);
  
  // Calculate total duration if both inAt and outAt exist
  const totalDuration = hasCheckedIn && hasCheckedOut && attendance?.inAt && attendance?.outAt
    ? formatElapsedTime(new Date(attendance.outAt).getTime() - new Date(attendance.inAt).getTime())
    : null;

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return null;
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return null;
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-violet-600" />
          <h3 className="font-semibold text-sm">Check In / Check Out</h3>
        </div>

        {isCheckedIn && (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Checked in at {formatTime(attendance?.inAt) || 'N/A'}</p>
              {/* Live Timer Display */}
              <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-200">
                <span className="text-xs font-semibold text-violet-700">Elapsed Time:</span>
                <span className="text-xl font-bold text-violet-600 font-mono">
                  {elapsedTime}
                </span>
              </div>
            </div>
            <Button
              onClick={handleCheckOut}
              disabled={isCheckingOut || punchOutMutation.isPending}
              className="w-full"
              variant="outline"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isCheckingOut || punchOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
            </Button>
          </div>
        )}

        {!isCheckedIn && !isCheckedOut && (
          <Button
            onClick={handleCheckIn}
            disabled={isCheckingIn || punchInMutation.isPending}
            className="w-full"
          >
            <LogIn className="mr-2 h-4 w-4" />
            {isCheckingIn || punchInMutation.isPending ? 'Checking In...' : 'Check In'}
          </Button>
        )}

        {isCheckedOut && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>In: {formatTime(attendance?.inAt) || 'N/A'}</p>
              <p>Out: {formatTime(attendance?.outAt) || 'N/A'}</p>
            </div>
            {/* Total Duration Display */}
            {totalDuration && (
              <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                <span className="text-xs font-semibold text-green-700">Total Duration:</span>
                <span className="text-lg font-bold text-green-600 font-mono">
                  {totalDuration}
                </span>
              </div>
            )}
            <div className="h-2 w-full bg-green-100 rounded-full">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

