import { useQuery } from '@tanstack/react-query';
import { TeamBoard } from '@/components/hrms/TeamBoard';
import { hrmsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Timer, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function Attendance() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const { data: attendance } = useQuery({
    queryKey: ['attendance', currentMonth],
    queryFn: () => hrmsApi.getMyAttendance(currentMonth),
  });

  const todayAttendance = attendance?.find((a) => a.day.startsWith(today));

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PRESENT: 'default',
      ABSENT: 'destructive',
      LEAVE: 'secondary',
      HALF_DAY: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="text-muted-foreground mt-1">
          Your attendance is automatically recorded when you start/stop time tracking
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Time Tracker Integration</AlertTitle>
        <AlertDescription className="mt-2">
          Attendance is automatically created and updated based on your time tracker activity.
          <br />
          <Button
            variant="link"
            className="p-0 h-auto mt-2"
            onClick={() => navigate('/hrms/time-tracker')}
          >
            <Timer className="mr-2 h-4 w-4" />
            Go to Time Tracker
          </Button>
        </AlertDescription>
      </Alert>

      {todayAttendance && (
        <Card>
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
            <CardDescription>
              {todayAttendance.inAt && (
                <>Checked in at {new Date(todayAttendance.inAt).toLocaleTimeString()}</>
              )}
              {todayAttendance.outAt && (
                <> • Checked out at {new Date(todayAttendance.outAt).toLocaleTimeString()}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant={todayAttendance.status === 'PRESENT' ? 'default' : 'secondary'}>
                {todayAttendance.status}
              </Badge>
              {todayAttendance.inAt && !todayAttendance.outAt && (
                <span className="text-sm text-muted-foreground">
                  Currently checked in - Timer is running
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-1">
        <TeamBoard day={today} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Attendance - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Punch In</TableHead>
                <TableHead>Punch Out</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance && attendance.length > 0 ? (
                attendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{new Date(record.day).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {record.inAt ? new Date(record.inAt).toLocaleTimeString() : '-'}
                    </TableCell>
                    <TableCell>
                      {record.outAt ? new Date(record.outAt).toLocaleTimeString() : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No attendance records for this month
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


