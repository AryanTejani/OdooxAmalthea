import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { hrmsApi, getErrorMessage, LeaveRequest } from '@/lib/api';
import { toast } from 'sonner';
import { useWS } from '@/hooks/useWS';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, X, FileText, Loader2, ExternalLink, Calendar, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTableLite, Column } from '@/components/ui-ext/DataTableLite';
import { StatusBadge } from '@/components/ui-ext/StatusBadge';
import { EmptyState } from '@/components/ui-ext/EmptyState';

// Helper function to calculate days between dates
function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Include both start and end dates
}

const leaveRequestSchema = z.object({
  type: z.enum(['CASUAL', 'SICK', 'UNPAID'], {
    errorMap: () => ({ message: 'Please select a leave type' }),
  }),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
  attachmentUrl: z.string().url().optional().or(z.literal('')),
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const { data: myLeaves, isLoading, refetch: refetchMyLeaves } = useQuery({
    queryKey: ['leave', 'mine'],
    queryFn: () => hrmsApi.getMyLeaveRequests(),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentFileName, setAttachmentFileName] = useState<string | null>(null);
  const [editingAttachmentUrl, setEditingAttachmentUrl] = useState<string | null>(null);
  const [editingAttachmentFileName, setEditingAttachmentFileName] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, control, setValue, watch } = useForm<LeaveRequestForm>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      type: 'CASUAL', // Default value to satisfy type, user can change
      startDate: '',
      endDate: '',
      reason: '',
      attachmentUrl: '',
    },
  });
  
  // Reset form when dialog opens
  const handleDialogOpenChange = (open: boolean) => {
    setNewLeaveOpen(open);
    if (!open) {
      // Reset when closing
      reset({
        type: 'CASUAL',
        startDate: '',
        endDate: '',
        reason: '',
        attachmentUrl: '',
      });
      setAttachmentUrl(null);
      setAttachmentFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingFile(true);
    try {
      const result = await hrmsApi.uploadFile(file, 'leave-attachments');
      setAttachmentUrl(result.url);
      setAttachmentFileName(file.name);
      setValue('attachmentUrl', result.url);
      toast.success('File uploaded successfully');
    } catch (error) {
      toast.error(getErrorMessage(error));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachmentUrl(null);
    setAttachmentFileName(null);
    setValue('attachmentUrl', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Subscribe to realtime updates
  useWS({
    onMessage: (event) => {
      if (event.table === 'leaveRequest' && event.op) {
        // Immediately refetch leave requests when status changes
        queryClient.invalidateQueries({ queryKey: ['leave'] });
        refetchMyLeaves();
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
      reset({
        type: 'CASUAL',
        startDate: '',
        endDate: '',
        reason: '',
        attachmentUrl: '',
      });
      setAttachmentUrl(null);
      setAttachmentFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LeaveRequestForm> }) => hrmsApi.updateLeaveRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      toast.success('Leave request updated successfully!');
      setEditDialogOpen(false);
      setEditingLeave(null);
      setEditingAttachmentUrl(null);
      setEditingAttachmentFileName(null);
      if (editFileInputRef.current) {
        editFileInputRef.current.value = '';
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleEditFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingFile(true);
    try {
      const result = await hrmsApi.uploadFile(file, 'leave-attachments');
      setEditingAttachmentUrl(result.url);
      setEditingAttachmentFileName(file.name);
      toast.success('File uploaded successfully');
    } catch (error) {
      toast.error(getErrorMessage(error));
      if (editFileInputRef.current) {
        editFileInputRef.current.value = '';
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveEditingAttachment = () => {
    setEditingAttachmentUrl(null);
    setEditingAttachmentFileName(null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  const handleEditDialogOpenChange = (open: boolean) => {
    setEditDialogOpen(open);
    if (open && editingLeave) {
      setEditingAttachmentUrl(editingLeave.attachmentUrl || null);
      setEditingAttachmentFileName(null);
    } else {
      setEditingLeave(null);
      setEditingAttachmentUrl(null);
      setEditingAttachmentFileName(null);
      if (editFileInputRef.current) {
        editFileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateLeave = () => {
    if (!editingLeave) return;

    const updateData: any = {};
    if (editingAttachmentUrl !== editingLeave.attachmentUrl) {
      updateData.attachmentUrl = editingAttachmentUrl || null;
    }

    if (Object.keys(updateData).length > 0) {
      updateMutation.mutate({ id: editingLeave.id, data: updateData });
    } else {
      toast.info('No changes to save');
    }
  };

  const onSubmit = (data: LeaveRequestForm) => {
    createMutation.mutate({
      ...data,
      attachmentUrl: data.attachmentUrl || undefined,
    });
  };

  // HR Officer, Payroll Officer (manager), and Admin can approve leaves
  const canManageLeaves = user?.role === 'hr' || user?.role === 'payroll' || user?.role === 'admin';

  // Calculate leave balances (mock - replace with actual API call if available)
  const leaveBalances = {
    paid: 12, // Casual + Sick
    sick: 5,
    casual: 7,
  };

  // Define columns for DataTableLite
  const columns: Column<LeaveRequest>[] = [
    {
      key: 'type',
      header: 'Type',
      cell: (row) => (
        <span className="font-medium">{row.type}</span>
      ),
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
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const statusMap: Record<string, 'pending' | 'approved' | 'rejected'> = {
          'PENDING': 'pending',
          'APPROVED': 'approved',
          'REJECTED': 'rejected',
        };
        return <StatusBadge status={statusMap[row.status]}>{row.status}</StatusBadge>;
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
            <FileText className="h-4 w-4 mr-1" />
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
        row.status === 'PENDING' ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingLeave(row);
                setEditDialogOpen(true);
              }}
            >
              Edit
            </Button>
          </div>
        ) : null
      ),
    },
  ];

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Leave Requests</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your leave requests and balances</p>
          </div>
          <div className="flex items-center gap-3">
            {canManageLeaves && (
              <Button variant="outline" onClick={() => navigate('/hrms/leave/approvals')}>
                View Approvals
              </Button>
            )}
            <Button onClick={() => setNewLeaveOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </div>
        </div>

        {/* Leave Balance Chips */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-6 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Leave Balance:</span>
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                Paid: {leaveBalances.paid}d
              </Badge>
              <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">
                Sick: {leaveBalances.sick}d
              </Badge>
              <Badge variant="default" className="bg-purple-100 text-purple-800 border-purple-200">
                Casual: {leaveBalances.casual}d
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Leave Requests Table */}
        <DataTableLite
          data={myLeaves || []}
          columns={columns}
          isLoading={isLoading}
          searchKey={(item) => `${item.type} ${item.reason} ${item.status}`}
          searchPlaceholder="Search leave requests..."
          emptyState={{
            icon: <Calendar className="h-12 w-12 text-muted-foreground" />,
            title: 'No leave requests',
            subtitle: 'You haven\'t submitted any leave requests yet.',
            action: {
              label: 'New Request',
              onClick: () => setNewLeaveOpen(true),
            },
          }}
        />

      <Dialog open={newLeaveOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Leave Request</DialogTitle>
            <DialogDescription>Submit a new leave request with details and attachment</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Leave Type</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select 
                    value={field.value} 
                    onValueChange={(value: 'CASUAL' | 'SICK' | 'UNPAID') => {
                      field.onChange(value);
                    }}
                  >
                    <SelectTrigger id="type" className={errors.type ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASUAL">Casual</SelectItem>
                      <SelectItem value="SICK">Sick</SelectItem>
                      <SelectItem value="UNPAID">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
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
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                {...register('reason')}
                placeholder="Enter reason for leave..."
                rows={3}
                className={errors.reason ? 'border-destructive' : ''}
              />
              {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="attachment">Attachment (Optional)</Label>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="attachment"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploadingFile}
                />
                {!attachmentUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="w-full"
                  >
                    {uploadingFile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload File
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="flex items-center justify-between p-3 border rounded-md bg-muted">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate">{attachmentFileName}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAttachment}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Supported formats: Images, PDF, Word, Excel, Text (Max 10MB)
                </p>
              </div>
            </div>
            <Button type="submit" disabled={createMutation.isPending || uploadingFile} className="w-full">
              {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
            <DialogDescription>Update attachment for your pending leave request</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editAttachment">Attachment</Label>
              <div className="space-y-2">
                <input
                  ref={editFileInputRef}
                  type="file"
                  id="editAttachment"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleEditFileChange}
                  className="hidden"
                  disabled={uploadingFile}
                />
                {!editingAttachmentUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="w-full"
                  >
                    {uploadingFile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload New File
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="flex items-center justify-between p-3 border rounded-md bg-muted">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate">
                        {editingAttachmentFileName || (editingLeave?.attachmentUrl ? 'Current attachment' : 'New file')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingLeave?.attachmentUrl && editingAttachmentUrl === editingLeave.attachmentUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(editingLeave.attachmentUrl!, '_blank')}
                          className="h-7 px-2"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveEditingAttachment}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Supported formats: Images, PDF, Word, Excel, Text (Max 10MB)
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleEditDialogOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUpdateLeave}
                disabled={updateMutation.isPending || uploadingFile}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


