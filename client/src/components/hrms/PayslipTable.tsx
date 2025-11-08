import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Payslip, PayrunStatus } from '@/lib/api';

interface PayslipTableProps {
  payslips: Payslip[];
  onRowClick?: (payslip: Payslip) => void;
  showActions?: boolean;
  onRecompute?: (payslipId: string) => void;
}

const statusVariants: Record<PayrunStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  computed: 'secondary',
  validated: 'default',
  done: 'default',
  cancelled: 'destructive',
};

export function PayslipTable({ payslips, onRowClick, showActions, onRecompute }: PayslipTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead className="text-right">Monthly Wage</TableHead>
          <TableHead className="text-right">Payable Days</TableHead>
          <TableHead className="text-right">Basic</TableHead>
          <TableHead className="text-right">Gross</TableHead>
          <TableHead className="text-right">Net</TableHead>
          <TableHead>Status</TableHead>
          {showActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {payslips.length > 0 ? (
          payslips.map((payslip) => (
            <TableRow 
              key={payslip.id}
              className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
              onClick={() => onRowClick?.(payslip)}
            >
              <TableCell>
                <div>
                  <p className="font-medium">{payslip.employee?.userName || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">
                    {payslip.employee?.code || payslip.employeeId}
                    {payslip.employee?.title && ` • ${payslip.employee.title}`}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(payslip.monthlyWage)}
              </TableCell>
              <TableCell className="text-right">
                <div>
                  <p className="font-medium">{payslip.payableDays.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    / {payslip.totalWorkingDays} days
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(payslip.basic)}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(payslip.gross)}</TableCell>
              <TableCell className="text-right font-semibold text-green-600">
                {formatCurrency(payslip.net)}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariants[payslip.status]}>
                  {payslip.status.toUpperCase()}
                </Badge>
              </TableCell>
              {showActions && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {payslip.status !== 'done' && onRecompute && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRecompute(payslip.id)}
                    >
                      Recompute
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={showActions ? 8 : 7} className="text-center text-muted-foreground">
              No payslips found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

