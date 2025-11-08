import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { Clock, LogIn, LogOut } from 'lucide-react';

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

interface PunchCardProps {
  todayAttendance?: {
    id?: string;
    inAt?: string | null;
    outAt?: string | null;
    status: string;
  };
}

export function PunchCard({ todayAttendance }: PunchCardProps) {
  const queryClient = useQueryClient();
  const [isPunching, setIsPunching] = useState(false);
  // Local state for optimistic updates
  const [localAttendance, setLocalAttendance] = useState(todayAttendance);
  // Ref to track if we're doing an optimistic update
  const isOptimisticUpdateRef = useRef(false);

  // Update local state when prop changes, but skip if we have an optimistic update
  useEffect(() => {
    if (!isOptimisticUpdateRef.current && todayAttendance !== undefined) {
      setLocalAttendance(todayAttendance);
    }
  }, [todayAttendance]);

  const punchInMutation = useMutation({
    mutationFn: () => hrmsApi.punchIn(),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['attendance'] });
      
      // Mark that we're doing an optimistic update
      isOptimisticUpdateRef.current = true;
      
      // Optimistically update local state
      const now = new Date().toISOString();
      setLocalAttendance((prev) => ({
        id: prev?.id,
        inAt: now,
        outAt: null,
        status: 'PRESENT',
      }));
    },
    onSuccess: async (data) => {
      // Update local state with actual response
      if (data) {
        // Handle both Date objects and ISO strings
        const inAtStr = data.inAt 
          ? (typeof data.inAt === 'string' ? data.inAt : new Date(data.inAt).toISOString())
          : null;
        const outAtStr = data.outAt 
          ? (typeof data.outAt === 'string' ? data.outAt : new Date(data.outAt).toISOString())
          : null;
        
        setLocalAttendance({
          id: data.id,
          inAt: inAtStr,
          outAt: outAtStr,
          status: data.status,
        });
      }
      // Reset optimistic update flag
      isOptimisticUpdateRef.current = false;
      
      // Invalidate and refetch all attendance queries
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      await queryClient.invalidateQueries({ queryKey: ['teamBoard'] });
      await queryClient.refetchQueries({ queryKey: ['attendance'] });
      toast.success('Punched in successfully!');
    },
    onError: (error) => {
      // Reset optimistic update flag
      isOptimisticUpdateRef.current = false;
      // Rollback optimistic update
      setLocalAttendance(todayAttendance);
      toast.error(getErrorMessage(error));
      setIsPunching(false);
    },
  });

  const punchOutMutation = useMutation({
    mutationFn: () => hrmsApi.punchOut(),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['attendance'] });
      
      // Mark that we're doing an optimistic update
      isOptimisticUpdateRef.current = true;
      
      // Optimistically update local state
      const now = new Date().toISOString();
      setLocalAttendance((prev) => ({
        id: prev?.id,
        inAt: prev?.inAt || now, // Keep existing inAt if it exists
        outAt: now,
        status: 'PRESENT',
      }));
    },
    onSuccess: async (data) => {
      // Update local state with actual response
      if (data) {
        // Handle both Date objects and ISO strings
        const inAtStr = data.inAt 
          ? (typeof data.inAt === 'string' ? data.inAt : new Date(data.inAt).toISOString())
          : null;
        const outAtStr = data.outAt 
          ? (typeof data.outAt === 'string' ? data.outAt : new Date(data.outAt).toISOString())
          : null;
        
        setLocalAttendance({
          id: data.id,
          inAt: inAtStr,
          outAt: outAtStr,
          status: data.status,
        });
      }
      // Reset optimistic update flag
      isOptimisticUpdateRef.current = false;
      
      // Invalidate and refetch all attendance queries
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      await queryClient.invalidateQueries({ queryKey: ['teamBoard'] });
      await queryClient.refetchQueries({ queryKey: ['attendance'] });
      toast.success('Punched out successfully!');
    },
    onError: (error) => {
      // Reset optimistic update flag
      isOptimisticUpdateRef.current = false;
      // Rollback optimistic update
      setLocalAttendance(todayAttendance);
      toast.error(getErrorMessage(error));
      setIsPunching(false);
    },
  });

  const handlePunchIn = async () => {
    if (isPunching || punchInMutation.isPending) return;
    setIsPunching(true);
    try {
      await punchInMutation.mutateAsync();
    } finally {
      setIsPunching(false);
    }
  };

  const handlePunchOut = async () => {
    if (isPunching || punchOutMutation.isPending) return;
    setIsPunching(true);
    try {
      await punchOutMutation.mutateAsync();
    } finally {
      setIsPunching(false);
    }
  };

  // Use localAttendance for UI state (supports optimistic updates)
  const attendance = localAttendance || todayAttendance;
  
  // Check if inAt exists - handle null, undefined, empty string, and falsy values
  const hasInAt = Boolean(attendance?.inAt);
  // Check if outAt exists - handle null, undefined, empty string, and falsy values  
  const hasOutAt = Boolean(attendance?.outAt);
  
  const canPunchIn = !hasInAt;
  const canPunchOut = hasInAt && !hasOutAt;
  const isCurrentlyCheckedIn = hasInAt && !hasOutAt;

  // Calculate elapsed time (timer) when user is checked in
  const elapsedTime = useElapsedTime(attendance?.inAt || null, isCurrentlyCheckedIn);
  
  // Calculate total duration if both inAt and outAt exist
  const totalDuration = hasInAt && hasOutAt && attendance?.inAt && attendance?.outAt
    ? formatElapsedTime(new Date(attendance.outAt).getTime() - new Date(attendance.inAt).getTime())
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Punch In:</span>
            <span className="text-sm font-medium">
              {attendance?.inAt
                ? new Date(attendance.inAt).toLocaleTimeString()
                : '--:--'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Punch Out:</span>
            <span className="text-sm font-medium">
              {attendance?.outAt
                ? new Date(attendance.outAt).toLocaleTimeString()
                : '--:--'}
            </span>
          </div>
          {/* Live Timer - Shows elapsed time when checked in */}
          {isCurrentlyCheckedIn && (
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm font-semibold text-violet-600">Elapsed Time:</span>
              <span className="text-lg font-bold text-violet-600 font-mono">
                {elapsedTime}
              </span>
            </div>
          )}
          {/* Total Duration - Shows when checked out */}
          {!isCurrentlyCheckedIn && totalDuration && (
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm font-semibold text-gray-600">Total Duration:</span>
              <span className="text-lg font-bold text-gray-700 font-mono">
                {totalDuration}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handlePunchIn}
            disabled={!canPunchIn || isPunching || punchInMutation.isPending}
            className="flex-1"
            variant={canPunchIn ? 'default' : 'outline'}
          >
            <LogIn className="h-4 w-4 mr-2" />
            {isPunching || punchInMutation.isPending ? 'Punching In...' : 'Punch In'}
          </Button>
          <Button
            onClick={handlePunchOut}
            disabled={!canPunchOut || isPunching || punchOutMutation.isPending}
            className="flex-1"
            variant={canPunchOut ? 'default' : 'outline'}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isPunching || punchOutMutation.isPending ? 'Punching Out...' : 'Punch Out'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


