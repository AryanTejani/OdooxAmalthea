import { useQuery } from '@tanstack/react-query';
import { PunchCard } from '@/components/hrms/PunchCard';
import { TeamBoard } from '@/components/hrms/TeamBoard';
import { hrmsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function Attendance() {
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
      <h1 className="text-3xl font-bold">Attendance</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <PunchCard todayAttendance={todayAttendance} />
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


