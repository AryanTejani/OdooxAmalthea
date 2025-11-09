import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { EmployeeCard, EmployeeGridItem } from '@/components/hrms/EmployeeCard';
import { EmployeeProfileModal } from '@/components/hrms/EmployeeProfileModal';
import { HRMSLayout } from '@/components/hrms/HRMSLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui-ext/EmptyState';
import { SkeletonCard } from '@/components/ui-ext/SkeletonCard';
import { hrmsApi } from '@/lib/api';
import { useWS } from '@/hooks/useWS';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { Search, Plus, Users, Circle } from 'lucide-react';

export function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeGridItem | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Get employees grid with status (using debounced search)
  const { data: employees, isLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ['employees', 'grid', debouncedSearch],
    queryFn: () => hrmsApi.getEmployeesGrid(debouncedSearch || undefined),
  });

  // Subscribe to realtime updates for attendance, time logs, and leave requests
  useWS({
    onMessage: (event) => {
      if (event.table === 'attendance' && event.op) {
        // Immediately refetch employees grid when attendance changes
        queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
        refetchEmployees();
      }
      if (event.table === 'time_logs' && event.op) {
        // Immediately refetch employees grid when time logs change
        queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
        refetchEmployees();
      }
      if (event.table === 'leaveRequest' && event.op) {
        // Immediately refetch employees grid when leave requests change (status updates)
        queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
        refetchEmployees();
      }
    },
    filter: (event) => event.table === 'attendance' || event.table === 'time_logs' || event.table === 'leaveRequest',
  });

  const handleEmployeeClick = (employee: EmployeeGridItem) => {
    setSelectedEmployee(employee);
    setProfileModalOpen(true);
  };

  const canCreateEmployees = user?.role === 'hr' || user?.role === 'admin';

  return (
    <HRMSLayout pageTitle="Employees">
      <div className="space-y-6">
        {/* Search and Action Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Search employees"
            />
          </div>
          {canCreateEmployees && (
            <Button onClick={() => navigate('/hrms/employees')} variant="default">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          )}
        </div>

        {/* Status Legend */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-6 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <div className="flex items-center gap-2">
                <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                <span className="text-sm">Present</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                <span className="text-sm">Idle</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-3 w-3 fill-blue-500 text-blue-500" />
                <span className="text-sm">On Leave</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                <span className="text-sm">Absent</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employees Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} showHeader={false} lines={2} />
            ))}
          </div>
        ) : employees && employees.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {employees.map((employee: EmployeeGridItem) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                onClick={() => handleEmployeeClick(employee)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Users className="h-12 w-12 text-muted-foreground" />}
            title="No employees found"
            subtitle={search ? 'Try adjusting your search terms' : 'No employees to display'}
            action={canCreateEmployees ? {
              label: 'Add Employee',
              onClick: () => navigate('/hrms/employees'),
            } : undefined}
          />
        )}
      </div>

      {/* Employee Profile Modal */}
      <EmployeeProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        employee={selectedEmployee}
      />
    </HRMSLayout>
  );
}

