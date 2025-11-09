import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trash2, Edit2, Loader2 } from 'lucide-react';
import { useWS } from '@/hooks/useWS';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Format duration in seconds to HH:MM:SS
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Get first day of current month
function getFirstDayOfMonth(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month, 1).toISOString().split('T')[0];
}

export function Timeline() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTimeLog, setSelectedTimeLog] = useState<any | null>(null);
  const [editDescription, setEditDescription] = useState<string>('');

  const { data: timeLogs, isLoading, refetch: refetchTimeLogs } = useQuery({
    queryKey: ['time-logs', 'me', startDate, endDate, selectedProjectId, selectedTaskId],
    queryFn: () => hrmsApi.getTimeLogs({
      startDate,
      endDate,
      projectId: selectedProjectId || undefined,
      taskId: selectedTaskId || undefined,
    }),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => hrmsApi.getProjects(),
  });

  // Get tasks for selected project
  const { data: tasks } = useQuery({
    queryKey: ['tasks', selectedProjectId],
    queryFn: () => hrmsApi.getTasksByProject(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  // Get my tasks (for when no project is selected)
  const { data: myTasks } = useQuery({
    queryKey: ['tasks', 'me'],
    queryFn: () => hrmsApi.getMyTasks(),
  });

  // Available tasks based on project selection
  const availableTasks = useMemo(() => {
    if (selectedProjectId) {
      return tasks || [];
    }
    return myTasks || [];
  }, [selectedProjectId, tasks, myTasks]);

  // Subscribe to realtime updates
  useWS({
    onMessage: (event) => {
      if (event.table === 'time_logs' && event.op) {
        // Immediately refetch time logs when changes occur
        queryClient.invalidateQueries({ queryKey: ['time-logs'] });
        refetchTimeLogs();
      }
    },
    filter: (event) => event.table === 'time_logs',
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hrmsApi.deleteTimeLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      toast.success('Time log deleted successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      hrmsApi.updateTimeLog(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      toast.success('Time log updated successfully');
      setEditDialogOpen(false);
      setSelectedTimeLog(null);
      setEditDescription('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleEdit = (timeLog: any) => {
    setSelectedTimeLog(timeLog);
    setEditDescription(timeLog.description || '');
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTimeLog) return;
    updateMutation.mutate({
      id: selectedTimeLog.id,
      data: {
        description: editDescription,
      },
    });
  };

  // Calculate statistics
  const stats = useMemo(() => {
    if (!timeLogs) return { totalSeconds: 0, billableSeconds: 0, totalHours: '0.00', billableHours: '0.00', count: 0 };
    
    const totalSeconds = timeLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const billableSeconds = timeLogs
      .filter(log => log.billable)
      .reduce((sum, log) => sum + (log.duration || 0), 0);
    
    return {
      totalSeconds,
      billableSeconds,
      totalHours: (totalSeconds / 3600).toFixed(2),
      billableHours: (billableSeconds / 3600).toFixed(2),
      count: timeLogs.length,
    };
  }, [timeLogs]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">My Timeline</h1>
        <p className="text-muted-foreground mt-1">
          View and manage your personal time logs
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select
                value={selectedProjectId || undefined}
                onValueChange={(value) => {
                  setSelectedProjectId(value === 'all' ? '' : value);
                  setSelectedTaskId(''); // Reset task when project changes
                }}
              >
                <SelectTrigger id="project">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects?.map((project: any) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task">Task</Label>
              <Select
                value={selectedTaskId || undefined}
                onValueChange={(value) => setSelectedTaskId(value === 'all' ? '' : value)}
                disabled={!selectedProjectId && availableTasks.length === 0}
              >
                <SelectTrigger id="task">
                  <SelectValue placeholder="All Tasks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  {availableTasks.map((task: any) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(getFirstDayOfMonth());
                setEndDate(new Date().toISOString().split('T')[0]);
                setSelectedProjectId('');
                setSelectedTaskId('');
              }}
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalHours} hours</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDuration(stats.totalSeconds)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Billable Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.billableHours} hours</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDuration(stats.billableSeconds)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.count}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Time log entries
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average per Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats.count > 0 
                ? ((stats.totalSeconds / stats.count) / 3600).toFixed(2)
                : '0.00'
              } hours
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.count > 0 
                ? formatDuration(Math.floor(stats.totalSeconds / stats.count))
                : '00:00:00'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Time Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Time Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading time logs...</span>
            </div>
          ) : timeLogs && timeLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Billable</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {new Date(log.startTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        {log.project?.name ? (
                          <Badge variant="outline">{log.project.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.task?.title || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.description || (
                          <span className="text-muted-foreground italic">No description</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {new Date(log.startTime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.endTime ? (
                          new Date(log.endTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatDuration(log.duration)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.billable ? 'default' : 'secondary'}>
                          {log.billable ? 'Billable' : 'Non-billable'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(log)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this time log?')) {
                                deleteMutation.mutate(log.id);
                              }
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                No time logs found
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your date range or filters
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Input
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What were you working on?"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedTimeLog(null);
                  setEditDescription('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

