import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LeaveRequest } from '@/lib/api';
import { Calendar, FileText, ExternalLink, Download } from 'lucide-react';

interface LeaveTableProps {
  leaves: LeaveRequest[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  showActions?: boolean;
}

export function LeaveTable({ leaves, onApprove, onReject, showActions = false }: LeaveTableProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PENDING: 'outline',
      APPROVED: 'default',
      REJECTED: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    return <Badge variant="secondary">{type}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Leave Requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {showActions && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Reason</TableHead>
              {showActions && <TableHead>Attachment</TableHead>}
              <TableHead>Status</TableHead>
              {showActions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.length > 0 ? (
              leaves.map((leave) => (
                <TableRow key={leave.id}>
                  {showActions && (
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{leave.employee?.userName || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">
                          {leave.employee?.code || leave.employeeId}
                          {leave.employee?.orgUnit && ` • ${leave.employee.orgUnit.name}`}
                        </span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>{getTypeBadge(leave.type)}</TableCell>
                  <TableCell>{new Date(leave.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(leave.endDate).toLocaleDateString()}</TableCell>
                  <TableCell className="max-w-xs truncate">{leave.reason || '-'}</TableCell>
                  {showActions && (
                    <TableCell>
                      {leave.attachmentUrl ? (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(leave.attachmentUrl!, '_blank')}
                            className="h-7 px-2"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = leave.attachmentUrl!;
                              link.download = '';
                              link.target = '_blank';
                              link.click();
                            }}
                            className="h-7 px-2"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No attachment</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>{getStatusBadge(leave.status)}</TableCell>
                  {showActions && leave.status === 'PENDING' && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => onApprove?.(leave.id)}
                          variant="default"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onReject?.(leave.id)}
                          variant="destructive"
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={showActions ? 8 : 5}
                  className="text-center text-muted-foreground"
                >
                  No leave requests
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


