import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

// Route to label mapping
const routeLabels: Record<string, string> = {
  '/hrms/dashboard': 'Dashboard',
  '/hrms/attendance': 'Attendance',
  '/hrms/attendance/admin': 'Attendance Admin',
  '/hrms/time-tracker': 'Time Tracker',
  '/hrms/timeline': 'Timeline',
  '/hrms/leave': 'Leave',
  '/hrms/leave/approvals': 'Leave Approvals',
  '/hrms/time-logs': 'Time Logs',
  '/hrms/payroll': 'Payroll',
  '/hrms/payroll/payruns': 'Payruns',
  '/hrms/salary': 'Salary',
  '/hrms/my/payslips': 'My Payslips',
  '/hrms/employees': 'Employees',
  '/hrms/reset-passwords': 'Reset Passwords',
  '/hrms/settings/users': 'Settings',
  '/profile': 'Profile',
  '/': 'Home',
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const location = useLocation();
  
  // Generate breadcrumbs from route if not provided
  const breadcrumbItems: BreadcrumbItem[] = items || (() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
    
    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
      const isLast = index === pathSegments.length - 1;
      crumbs.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });
    
    return crumbs;
  })();

  return (
    <nav className={cn('flex items-center space-x-2 text-sm', className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          
          return (
            <li key={index} className="flex items-center">
              {index === 0 && item.href ? (
                <Link
                  to={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Home"
                >
                  <Home className="h-4 w-4" />
                </Link>
              ) : item.href ? (
                <Link
                  to={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={cn(isLast ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

