import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hrmsApi } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Users } from 'lucide-react';

// Format duration in seconds to HH:MM:SS
function formatDuration(seconds: number | null): string {
  if (!seconds) return '00:00:00';
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

export function TimeLogs() {
  const { user } = useAuth();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [billableFilter, setBillableFilter] = useState<string>('all');

  // Get all employees
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrmsApi.getAllEmployees(),
  });

  // Get all projects
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => hrmsApi.getProjects(),
  });

  // Get time logs with filters
  const { data: timeLogs, isLoading } = useQuery({
    queryKey: ['time-logs', 'all', selectedEmployeeId, selectedProjectId, startDate, endDate, billableFilter],
    queryFn: () => hrmsApi.getTimeLogs({
      employeeId: selectedEmployeeId || undefined,
      projectId: selectedProjectId || undefined,
      startDate,
      endDate,
      billable: billableFilter === 'all' ? undefined : billableFilter === 'billable',
    }),
  });

  // Calculate statistics
  const stats = useMemo(() => {
    if (!timeLogs) return { totalSeconds: 0, billableSeconds: 0, totalHours: '0.00', billableHours: '0.00', count: 0, employeeCount: 0 };
    
    const totalSeconds = timeLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    const billableSeconds = timeLogs
      .filter(log => log.billable)
      .reduce((sum, log) => sum + (log.duration || 0), 0);
    
    // Count unique employees
    const uniqueEmployees = new Set(timeLogs.map(log => log.employeeId));
    
    return {
      totalSeconds,
      billableSeconds,
      totalHours: (totalSeconds / 3600).toFixed(2),
      billableHours: (billableSeconds / 3600).toFixed(2),
      count: timeLogs.length,
      employeeCount: uniqueEmployees.size,
    };
  }, [timeLogs]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Employee Time Logs</h1>
        <p className="text-muted-foreground mt-1">
          {user?.role === 'admin' 
            ? 'View and monitor all employee time tracking (including HR)'
            : 'View and monitor all employee time tracking'
          }
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee</Label>
              <Select
                value={selectedEmployeeId || 'all'}
                onValueChange={(value) => setSelectedEmployeeId(value === 'all' ? '' : value)}
              >
                <SelectTrigger id="employee">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees?.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.userName || emp.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select
                value={selectedProjectId || 'all'}
                onValueChange={(value) => setSelectedProjectId(value === 'all' ? '' : value)}
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
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="billable">Billable</Label>
            <Select
              value={billableFilter}
              onValueChange={setBillableFilter}
            >
              <SelectTrigger id="billable">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="billable">Billable Only</SelectItem>
                <SelectItem value="non-billable">Non-billable Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalHours} hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Billable Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.billableHours} hours</p>
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
              Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.employeeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Active employees
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
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Billable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{log.employeeName || log.employeeCode || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
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
    </div>
  );
}

