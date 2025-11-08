import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { hrmsApi } from '@/lib/api';
import { useWS } from '@/hooks/useWS';
import { Users } from 'lucide-react';

interface TeamBoardProps {
  day?: string;
  orgUnitId?: string;
}

export function TeamBoard({ day, orgUnitId }: TeamBoardProps) {
  const { data: board, refetch } = useQuery({
    queryKey: ['teamBoard', day, orgUnitId],
    queryFn: () => hrmsApi.getTeamBoard(day, orgUnitId),
  });

  // Subscribe to realtime updates
  useWS({
    onMessage: (event) => {
      if (event.table === 'attendance' && event.op) {
        refetch();
      }
    },
    filter: (event) => event.table === 'attendance',
  });

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Board
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Punch In</TableHead>
              <TableHead>Punch Out</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {board && board.length > 0 ? (
              board.map((entry: any) => (
                <TableRow key={entry.employeeId}>
                  <TableCell className="font-medium">
                    {entry.employeeName || entry.employeeCode}
                  </TableCell>
                  <TableCell>{entry.orgUnitName || '-'}</TableCell>
                  <TableCell>
                    {entry.inAt ? new Date(entry.inAt).toLocaleTimeString() : '-'}
                  </TableCell>
                  <TableCell>
                    {entry.outAt ? new Date(entry.outAt).toLocaleTimeString() : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(entry.status)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No attendance records for today
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


