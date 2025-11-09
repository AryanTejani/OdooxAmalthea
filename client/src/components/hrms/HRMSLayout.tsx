import { Sidebar } from './Sidebar';
import { UserAvatarDropdown } from './UserAvatarDropdown';
import { Breadcrumbs } from '@/components/ui-ext/Breadcrumbs';
import { useBrand } from '@/context/BrandContext';
import { Building2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface HRMSLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function HRMSLayout({ children, pageTitle }: HRMSLayoutProps) {
  const { company } = useBrand();
  const location = useLocation();

  // Get page title from route if not provided
  const routeLabels: Record<string, string> = {
    '/hrms/dashboard': 'Dashboard',
    '/hrms/attendance': 'My Attendance',
    '/hrms/attendance/admin': 'Attendance Overview',
    '/hrms/time-tracker': 'Time Tracker',
    '/hrms/timeline': 'Timeline',
    '/hrms/leave': 'Leave Requests',
    '/hrms/leave/approvals': 'Leave Approvals',
    '/hrms/time-logs': 'Time Logs',
    '/hrms/payroll': 'Payroll Dashboard',
    '/hrms/payroll/payruns': 'Payruns',
    '/hrms/salary': 'Salary Management',
    '/hrms/my/payslips': 'My Payslips',
    '/hrms/employees': 'Employees',
    '/hrms/reports': 'Reports',
    '/hrms/reports/salary-statement': 'Salary Statement Report',
    '/hrms/reset-passwords': 'Reset Passwords',
    '/hrms/settings/users': 'User Settings',
    '/profile': 'My Profile',
    '/': 'Home',
  };

  const displayTitle = pageTitle || routeLabels[location.pathname] || 'WorkZen HRMS';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>

      <Sidebar />
      
      <div className="md:pl-64">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Left: Company logo/name and page title */}
              <div className="flex items-center gap-4">
                {company?.logoUrl ? (
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="h-10 w-10 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{displayTitle}</h1>
                  <Breadcrumbs className="mt-1" />
                </div>
              </div>

              {/* Right: User menu */}
              <div className="flex items-center">
                <UserAvatarDropdown />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main id="main-content" className="min-h-screen px-6 py-4 md:px-6 md:py-4">
          {children}
        </main>
      </div>
    </div>
  );
}

