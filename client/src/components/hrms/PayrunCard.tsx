import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Payrun, PayrunStatus } from '@/lib/api';
import { Calendar, Users, IndianRupee } from 'lucide-react';

interface PayrunCardProps {
  payrun: Payrun;
  onClick?: () => void;
}

const statusVariants: Record<PayrunStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  computed: 'secondary',
  validated: 'default',
  done: 'default',
  cancelled: 'destructive',
};

const statusColors: Record<PayrunStatus, string> = {
  draft: 'text-gray-500',
  computed: 'text-blue-500',
  validated: 'text-green-500',
  done: 'text-green-600',
  cancelled: 'text-red-500',
};

export function PayrunCard({ payrun, onClick }: PayrunCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <Card 
      className={`hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatMonth(payrun.month)}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Payrun #{payrun.id.slice(0, 8)}
            </p>
          </div>
          <Badge variant={statusVariants[payrun.status]}>
            {payrun.status.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Employees
            </p>
            <p className="text-lg font-semibold">{payrun.employeesCount || payrun.payslipsCount || 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <IndianRupee className="h-3 w-3" />
              Gross
            </p>
            <p className="text-lg font-semibold">{formatCurrency(payrun.grossTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <IndianRupee className="h-3 w-3" />
              Net
            </p>
            <p className="text-lg font-semibold">{formatCurrency(payrun.netTotal)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

