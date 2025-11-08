import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { LeaveTable } from '@/components/hrms/LeaveTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { useWS } from '@/hooks/useWS';
export function LeaveApprovals() {
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: pendingLeaves } = useQuery({
    queryKey: ['leave', 'pending'],
    queryFn: () => hrmsApi.getPendingLeaveRequests(),
  });

  // Subscribe to realtime updates
  useWS({
    onMessage: (event) => {
      if (event.table === 'leaveRequest' && event.op) {
        queryClient.invalidateQueries({ queryKey: ['leave'] });
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

  const handleRejectConfirm = () => {
    if (selectedLeaveId) {
      rejectMutation.mutate({ id: selectedLeaveId, reason: rejectReason || undefined });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve pending leave requests
          </p>
        </div>
      </div>

      <LeaveTable
        leaves={pendingLeaves || []}
        onApprove={(id) => approveMutation.mutate(id)}
        onReject={handleRejectClick}
        showActions
      />

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
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
              />
            </div>
            <div className="flex justify-end gap-2">
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

