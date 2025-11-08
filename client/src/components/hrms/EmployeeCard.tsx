import { Card, CardContent } from '@/components/ui/card';
import { User, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmployeeGridItem {
  id: string;
  userId: string;
  code: string;
  title?: string | null;
  userName?: string;
  userEmail?: string;
  orgUnit?: {
    id: string;
    name: string;
  } | null;
  status: 'active' | 'idle' | 'off' | 'leave';
  inAt?: string | null;
  outAt?: string | null;
}

interface EmployeeCardProps {
  employee: EmployeeGridItem;
  onClick: () => void;
}

export function EmployeeCard({ employee, onClick }: EmployeeCardProps) {
  const getStatusIndicator = () => {
    if (employee.status === 'leave') {
      return (
        <div className="absolute top-2 right-2" title="On Leave">
          <Plane className="h-4 w-4 text-blue-500" />
        </div>
      );
    }
    
    if (employee.status === 'active') {
      return (
        <div className="absolute top-2 right-2" title="Active">
          <div className="h-3 w-3 rounded-full bg-green-500 border-2 border-white shadow-sm animate-pulse" />
        </div>
      );
    }
    
    if (employee.status === 'idle') {
      return (
        <div className="absolute top-2 right-2" title="Idle">
          <div className="h-3 w-3 rounded-full bg-yellow-500 border-2 border-white shadow-sm" />
        </div>
      );
    }
    
    // off
    return (
      <div className="absolute top-2 right-2" title="Off">
        <div className="h-3 w-3 rounded-full bg-gray-400 border-2 border-white shadow-sm" />
      </div>
    );
  };

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-shadow relative',
        'hover:border-violet-300'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
        {getStatusIndicator()}
        <div className="h-16 w-16 rounded-full bg-violet-100 flex items-center justify-center">
          <User className="h-8 w-8 text-violet-600" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-sm">{employee.userName || 'Unknown'}</p>
          {employee.title && (
            <p className="text-xs text-muted-foreground">{employee.title}</p>
          )}
          {employee.orgUnit && (
            <p className="text-xs text-muted-foreground">{employee.orgUnit.name}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

