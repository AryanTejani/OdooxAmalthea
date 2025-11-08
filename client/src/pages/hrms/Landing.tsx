import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { EmployeeCard, EmployeeGridItem } from '@/components/hrms/EmployeeCard';
import { EmployeeProfileModal } from '@/components/hrms/EmployeeProfileModal';
import { CheckInOutPanel } from '@/components/hrms/CheckInOutPanel';
import { UserAvatarDropdown } from '@/components/hrms/UserAvatarDropdown';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { hrmsApi } from '@/lib/api';
import { useWS } from '@/hooks/useWS';
import { Search, Plus } from 'lucide-react';

export function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeGridItem | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Get employees grid with status
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', 'grid', search],
    queryFn: () => hrmsApi.getEmployeesGrid(search || undefined),
  });

  // Subscribe to realtime updates for attendance and leave requests
  useWS({
    onMessage: (event) => {
      if (event.table === 'attendance' && event.op) {
        queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
      }
      if (event.table === 'leaveRequest' && event.op) {
        queryClient.invalidateQueries({ queryKey: ['employees', 'grid'] });
      }
    },
    filter: (event) => event.table === 'attendance' || event.table === 'leaveRequest',
  });

  const handleEmployeeClick = (employee: EmployeeGridItem) => {
    setSelectedEmployee(employee);
    setProfileModalOpen(true);
  };

  const canCreateEmployees = user?.role === 'hr' || user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">WorkZen HRMS</h1>
          </div>
          <div className="flex items-center gap-4">
            {canCreateEmployees && (
              <Button onClick={() => navigate('/hrms/employees')} variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Employee
              </Button>
            )}
            <UserAvatarDropdown />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Search and Action Bar */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees by name, email, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Employees Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
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
            <div className="text-center py-12">
              <p className="text-muted-foreground">No employees found</p>
            </div>
          )}
        </main>

        {/* Right Sidebar */}
        <aside className="w-80 p-6 border-l border-gray-200 bg-white">
          <CheckInOutPanel />
        </aside>
      </div>

      {/* Employee Profile Modal */}
      <EmployeeProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        employee={selectedEmployee}
      />
    </div>
  );
}

