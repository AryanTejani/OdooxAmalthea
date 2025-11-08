import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  DollarSign,
  User,
  LogOut,
  Clock,
  Timer,
  FolderKanban,
  ListTodo,
  Key,
  Settings,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[]; // If undefined, all roles can access
  badge?: string;
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/hrms/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Attendance',
    href: '/hrms/attendance',
    icon: Clock,
  },
  {
    title: 'Attendance (Admin)',
    href: '/hrms/attendance/admin',
    icon: Clock,
    roles: ['admin', 'hr', 'payroll'],
    badge: 'Admin/HR',
  },
  {
    title: 'Time Tracker',
    href: '/hrms/time-tracker',
    icon: Timer,
  },
  {
    title: 'Timeline',
    href: '/hrms/timeline',
    icon: Calendar,
  },
  {
    title: 'Leave',
    href: '/hrms/leave',
    icon: Calendar,
  },
  {
    title: 'Projects',
    href: '/hrms/projects',
    icon: FolderKanban,
    roles: ['admin', 'hr'],
  },
  {
    title: 'Tasks',
    href: '/hrms/tasks',
    icon: ListTodo,
    roles: ['admin', 'hr'],
  },
  {
    title: 'Time Logs',
    href: '/hrms/time-logs',
    icon: Timer,
    roles: ['admin', 'hr', 'payroll'], // Admin, HR Officer, Payroll Officer
    badge: 'All',
  },
  {
    title: 'Leave Approvals',
    href: '/hrms/leave/approvals',
    icon: FileText,
    roles: ['admin', 'hr', 'payroll'],
    badge: 'HR/Payroll',
  },
  {
    title: 'Payroll',
    href: '/hrms/payroll',
    icon: DollarSign,
    roles: ['admin', 'payroll'],
    badge: 'Payroll',
  },
  {
    title: 'Employees',
    href: '/hrms/employees',
    icon: Users,
  },
  {
    title: 'Reset Passwords',
    href: '/hrms/reset-passwords',
    icon: Key,
    roles: ['admin'],
    badge: 'Admin',
  },
  {
    title: 'Settings',
    href: '/hrms/settings/users',
    icon: Settings,
    roles: ['admin'],
    badge: 'Admin',
  },
  {
    title: 'Profile',
    href: '/profile',
    icon: User,
  },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { company } = useBrand();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true; // All roles can access
    return item.roles.includes(user?.role || '');
  });

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-gradient-to-b from-violet-50 to-white border-r border-violet-100">
      <div className="flex flex-col flex-grow pt-6 pb-4 overflow-y-auto">
        {/* Logo/Brand */}
        <div className="flex items-center flex-shrink-0 px-6 mb-8">
          <div className="flex items-center space-x-3">
            {company?.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.name}
                className="h-10 w-10 rounded-lg object-cover"
                onError={(e) => {
                  // Fallback to icon if image fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600',
                company?.logoUrl && 'hidden'
              )}
            >
              {company?.logoUrl ? (
                <Building2 className="h-6 w-6 text-white" />
              ) : (
                <Users className="h-6 w-6 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-violet-900 truncate">
                {company?.name || 'WorkZen'}
              </h1>
              <p className="text-xs text-violet-600">
                {company ? `Code: ${company.code}` : 'HRMS Platform'}
              </p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="px-6 mb-6">
          <div className="rounded-lg bg-white p-4 border border-violet-100 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <div className="mt-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                {user?.role === 'admin' && 'Admin'}
                {user?.role === 'hr' && 'HR Officer'}
                {user?.role === 'payroll' && 'Payroll Officer'}
                {user?.role === 'employee' && 'Employee'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-violet-50 hover:text-violet-900'
                )}
              >
                <Icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-violet-600'
                  )}
                />
                <span className="flex-1">{item.title}</span>
                {item.badge && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-800">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="px-3 mt-auto pt-4">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}

