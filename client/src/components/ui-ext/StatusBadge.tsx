import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusVariant = 
  | 'success' 
  | 'warn' 
  | 'info' 
  | 'danger' 
  | 'neutral'
  | 'present'
  | 'idle'
  | 'leave'
  | 'absent'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'draft'
  | 'computed'
  | 'validated'
  | 'paid'
  | 'cancelled';

interface StatusBadgeProps {
  status: StatusVariant;
  children: React.ReactNode;
  className?: string;
}

const statusConfig: Record<StatusVariant, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  // Generic statuses
  success: { variant: 'default', className: 'bg-green-100 text-green-800 border-green-200' },
  warn: { variant: 'default', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  info: { variant: 'default', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  danger: { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200' },
  neutral: { variant: 'secondary', className: 'bg-gray-100 text-gray-800 border-gray-200' },
  
  // Attendance statuses
  present: { variant: 'default', className: 'bg-green-100 text-green-800 border-green-200' },
  idle: { variant: 'default', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  leave: { variant: 'default', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  absent: { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200' },
  
  // Leave request statuses
  pending: { variant: 'default', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  approved: { variant: 'default', className: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200' },
  
  // Payroll statuses
  draft: { variant: 'secondary', className: 'bg-gray-100 text-gray-800 border-gray-200' },
  computed: { variant: 'default', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  validated: { variant: 'default', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  paid: { variant: 'default', className: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200' },
};

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  // If status is not found in config, use neutral as fallback
  if (!config) {
    console.warn(`StatusBadge: Unknown status "${status}", using neutral fallback`);
    const fallbackConfig = statusConfig.neutral;
    return (
      <Badge
        variant={fallbackConfig.variant}
        className={cn(fallbackConfig.className, className)}
      >
        {children}
      </Badge>
    );
  }
  
  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {children}
    </Badge>
  );
}

