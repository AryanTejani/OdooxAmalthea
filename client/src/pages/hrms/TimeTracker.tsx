import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Play, Square, Timer as TimerIcon } from 'lucide-react';
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

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startTime, isActive]);

  return elapsed;
}

export function TimeTracker() {
  const queryClient = useQueryClient();
  const [taskName, setTaskName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [billable, setBillable] = useState<boolean>(true);

  // Get active timer
  const { data: activeTimer, refetch: refetchActiveTimer } = useQuery({
    queryKey: ['time-logs', 'active'],
    queryFn: () => hrmsApi.getActiveTimer(),
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Calculate if timer is running (needed before useEffect)
  const isTimerRunning = !!activeTimer && !activeTimer.endTime;

  // Subscribe to realtime updates
  useWS({
    onMessage: (event) => {
      if (event.table === 'time_logs' && event.op) {
        queryClient.invalidateQueries({ queryKey: ['time-logs'] });
        refetchActiveTimer();
      }
      if (event.table === 'attendance' && event.op) {
        queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
      }
    },
    filter: (event) => event.table === 'time_logs' || event.table === 'attendance',
  });

  // Heartbeat: Send heartbeat every 5 minutes while timer is running
  useEffect(() => {
    if (!isTimerRunning) return;

    const sendHeartbeat = async () => {
      try {
        await hrmsApi.heartbeat();
        queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
      } catch (error) {
        // Silently fail - heartbeat is best-effort
        console.warn('Heartbeat failed:', error);
      }
    };

    // Send immediate heartbeat when timer starts
    sendHeartbeat();

    // Send heartbeat every 5 minutes
    const heartbeatInterval = setInterval(sendHeartbeat, 5 * 60 * 1000);

    // Send heartbeat when page becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTimerRunning, queryClient]);

  const startTimerMutation = useMutation({
    mutationFn: () => hrmsApi.startTimer({
      taskName: taskName || undefined,
      description: description || undefined,
      billable,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      refetchActiveTimer();
      toast.success('Timer started! Attendance automatically recorded.');
      setTaskName('');
      setDescription('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: () => hrmsApi.stopTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      refetchActiveTimer();
      toast.success('Timer stopped! Attendance automatically updated.');
      setTaskName('');
      setDescription('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const elapsedTime = useElapsedTime(
    activeTimer?.startTime || null,
    isTimerRunning
  );


  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Time Tracker</h1>
        <p className="text-muted-foreground mt-1">
          Track your work time. All time is automatically logged to your timeline.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Timer Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TimerIcon className="h-5 w-5" />
              Active Timer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTimerRunning ? (
              <>
                <div className="text-center p-6 bg-violet-50 rounded-lg border border-violet-200">
                  <div className="text-4xl font-bold text-violet-600 font-mono mb-2">
                    {elapsedTime}
                  </div>
                  {activeTimer.taskName && (
                    <p className="text-sm font-medium text-violet-700 mb-1">
                      {activeTimer.taskName}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {activeTimer.description || 'No description'}
                  </p>
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    ✓ Time is being logged automatically
                  </p>
                </div>
                <Button
                  onClick={() => stopTimerMutation.mutate()}
                  disabled={stopTimerMutation.isPending}
                  className="w-full"
                  variant="destructive"
                  size="lg"
                >
                  <Square className="mr-2 h-4 w-4" />
                  {stopTimerMutation.isPending ? 'Stopping...' : 'Stop Timer'}
                </Button>
              </>
            ) : (
              <div className="text-center p-6">
                <p className="text-muted-foreground mb-4">No active timer</p>
                <div className="text-2xl font-mono text-gray-400">00:00:00</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Start Timer Form */}
        <Card>
          <CardHeader>
            <CardTitle>Start New Timer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="taskName">Task Name (Optional)</Label>
              <Input
                id="taskName"
                placeholder="e.g., Development, Meeting, Documentation"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                disabled={isTimerRunning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="What are you working on?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isTimerRunning}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="billable"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                disabled={isTimerRunning}
                className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <Label htmlFor="billable" className="text-sm font-normal cursor-pointer">
                Billable hours
              </Label>
            </div>

            <Button
              onClick={() => startTimerMutation.mutate()}
              disabled={isTimerRunning || startTimerMutation.isPending}
              className="w-full"
              size="lg"
            >
              <Play className="mr-2 h-4 w-4" />
              {startTimerMutation.isPending ? 'Starting...' : 'Start Timer'}
            </Button>

            {isTimerRunning && (
              <p className="text-sm text-amber-600 text-center">
                Please stop the current timer before starting a new one
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

