import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hrmsApi, getErrorMessage, LeaveRequest } from '@/lib/api';
import { DataTableLite, Column } from '@/components/ui-ext/DataTableLite';
import { toast } from 'sonner';
import { useWS } from '@/hooks/useWS';
import { CheckCircle, XCircle, Calendar } from 'lucide-react';

// Helper function to calculate days between dates
function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}
export function LeaveApprovals() {
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: pendingLeaves, refetch: refetchPendingLeaves } = useQuery({
    queryKey: ['leave', 'pending'],
    queryFn: () => hrmsApi.getPendingLeaveRequests(),
  });

  // Subscribe to realtime updates
  useWS({
    onMessage: (event) => {
      if (event.table === 'leaveRequest' && event.op) {
        // Immediately refetch pending leaves when status changes (approved/rejected)
        queryClient.invalidateQueries({ queryKey: ['leave'] });
        refetchPendingLeaves();
      }
    },
    filter: (event) => event.table === 'leaveRequest',
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => hrmsApi.approveLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      toast.success('Leave request approved!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => hrmsApi.rejectLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      toast.success('Leave request rejected!');
      setRejectDialogOpen(false);
      setSelectedLeaveId(null);
      setRejectReason('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleRejectClick = (id: string) => {
    setSelectedLeaveId(id);
    setRejectDialogOpen(true);
  };

  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [approveLeaveId, setApproveLeaveId] = useState<string | null>(null);

  const handleApproveClick = (id: string) => {
    setApproveLeaveId(id);
    setApproveConfirmOpen(true);
  };

  const handleApproveConfirm = () => {
    if (approveLeaveId) {
      approveMutation.mutate(approveLeaveId);
      setApproveConfirmOpen(false);
      setApproveLeaveId(null);
    }
  };

  const handleRejectConfirm = () => {
    if (selectedLeaveId) {
      rejectMutation.mutate({ id: selectedLeaveId, reason: rejectReason || undefined });
    }
  };

  // Define columns for DataTableLite
  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employee',
      header: 'Employee',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.employee?.userName || 'Unknown'}</div>
          <div className="text-xs text-muted-foreground">
            {row.employee?.code || row.employeeId}
            {row.employee?.orgUnit && ` • ${row.employee.orgUnit.name}`}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => <span className="font-medium">{row.type}</span>,
    },
    {
      key: 'dates',
      header: 'Dates',
      cell: (row) => {
        const days = calculateDays(row.startDate, row.endDate);
        return (
          <div>
            <div className="text-sm">
              {new Date(row.startDate).toLocaleDateString()} - {new Date(row.endDate).toLocaleDateString()}
            </div>
            <div className="text-xs text-muted-foreground">{days} day{days !== 1 ? 's' : ''}</div>
          </div>
        );
      },
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (row) => (
        <div className="max-w-xs">
          <p className="text-sm truncate" title={row.reason}>{row.reason}</p>
        </div>
      ),
    },
    {
      key: 'attachment',
      header: 'Attachment',
      cell: (row) => (
        row.attachmentUrl ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(row.attachmentUrl!, '_blank')}
            className="h-8"
            aria-label="View attachment"
          >
            View
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">No attachment</span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleApproveClick(row.id)}
            disabled={approveMutation.isPending}
            aria-label="Approve leave request"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleRejectClick(row.id)}
            disabled={rejectMutation.isPending}
            aria-label="Reject leave request"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Leave Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve pending leave requests
          </p>
        </div>

        <DataTableLite
          data={pendingLeaves || []}
          columns={columns}
          isLoading={false}
          searchKey={(item) => `${item.employee?.userName || ''} ${item.type} ${item.reason}`}
          searchPlaceholder="Search leave requests..."
          emptyState={{
            icon: <Calendar className="h-12 w-12 text-muted-foreground" />,
            title: 'No pending leave requests',
            subtitle: 'All leave requests have been processed.',
          }}
        />

        {/* Approve Confirmation Dialog */}
        <Dialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Leave Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to approve this leave request?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setApproveConfirmOpen(false);
                  setApproveLeaveId(null);
                }}
                disabled={approveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleApproveConfirm}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Leave Request</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this leave request (optional).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rejectReason">Reason (Optional)</Label>
                <Input
                  id="rejectReason"
                  placeholder="Enter rejection reason..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  disabled={rejectMutation.isPending}
                  aria-label="Rejection reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectReason('');
                  setSelectedLeaveId(null);
                }}
                disabled={rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleRejectConfirm}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}

