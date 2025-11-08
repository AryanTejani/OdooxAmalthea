import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { LeaveTable } from '@/components/hrms/LeaveTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { useWS } from '@/hooks/useWS';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const leaveRequestSchema = z.object({
  type: z.enum(['CASUAL', 'SICK', 'UNPAID']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
}).refine((data) => {
  return new Date(data.endDate) >= new Date(data.startDate);
}, {
  message: 'End date must be after or equal to start date',
  path: ['endDate'],
});

type LeaveRequestForm = z.infer<typeof leaveRequestSchema>;

export function Leave() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newLeaveOpen, setNewLeaveOpen] = useState(false);
  const { data: myLeaves } = useQuery({
    queryKey: ['leave', 'mine'],
    queryFn: () => hrmsApi.getMyLeaveRequests(),
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<LeaveRequestForm>({
    resolver: zodResolver(leaveRequestSchema),
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

  const createMutation = useMutation({
    mutationFn: (data: LeaveRequestForm) => hrmsApi.createLeaveRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      toast.success('Leave request submitted successfully!');
      setNewLeaveOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });


  const onSubmit = (data: LeaveRequestForm) => {
    createMutation.mutate(data);
  };

  const canManageLeaves = user?.role === 'hr' || user?.role === 'manager' || user?.role === 'admin';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Leave Management</h1>
        <div className="flex gap-2">
          {canManageLeaves && (
            <Button variant="outline" onClick={() => navigate('/hrms/leave/approvals')}>
              View Approvals
            </Button>
          )}
          <Button onClick={() => setNewLeaveOpen(true)}>New Leave Request</Button>
        </div>
      </div>

      <LeaveTable leaves={myLeaves || []} />

      <Dialog open={newLeaveOpen} onOpenChange={setNewLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Leave Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Leave Type</Label>
              <Select id="type" {...register('type')}>
                <option value="">Select type</option>
                <option value="CASUAL">Casual</option>
                <option value="SICK">Sick</option>
                <option value="UNPAID">Unpaid</option>
              </Select>
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
              {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input id="reason" {...register('reason')} />
            </div>
            <Button type="submit" disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}


