import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { Clock, LogIn, LogOut } from 'lucide-react';

interface PunchCardProps {
  todayAttendance?: {
    inAt?: string;
    outAt?: string;
    status: string;
  };
}

export function PunchCard({ todayAttendance }: PunchCardProps) {
  const queryClient = useQueryClient();
  const [isPunching, setIsPunching] = useState(false);

  const punchInMutation = useMutation({
    mutationFn: () => hrmsApi.punchIn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teamBoard'] });
      toast.success('Punched in successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const punchOutMutation = useMutation({
    mutationFn: () => hrmsApi.punchOut(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teamBoard'] });
      toast.success('Punched out successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handlePunchIn = async () => {
    setIsPunching(true);
    await punchInMutation.mutateAsync();
    setIsPunching(false);
  };

  const handlePunchOut = async () => {
    setIsPunching(true);
    await punchOutMutation.mutateAsync();
    setIsPunching(false);
  };

  const canPunchIn = !todayAttendance?.inAt;
  const canPunchOut = todayAttendance?.inAt && !todayAttendance?.outAt;

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
              {todayAttendance?.inAt
                ? new Date(todayAttendance.inAt).toLocaleTimeString()
                : '--:--'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Punch Out:</span>
            <span className="text-sm font-medium">
              {todayAttendance?.outAt
                ? new Date(todayAttendance.outAt).toLocaleTimeString()
                : '--:--'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handlePunchIn}
            disabled={!canPunchIn || isPunching}
            className="flex-1"
            variant={canPunchIn ? 'default' : 'outline'}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Punch In
          </Button>
          <Button
            onClick={handlePunchOut}
            disabled={!canPunchOut || isPunching}
            className="flex-1"
            variant={canPunchOut ? 'default' : 'outline'}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Punch Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


