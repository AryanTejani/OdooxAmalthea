import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Payslip } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PayslipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payslip: Payslip | null;
}

export function PayslipModal({ open, onOpenChange, payslip }: PayslipModalProps) {
  if (!payslip) return null;

  const breakdown = payslip.breakdown as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payslip Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Basic</TableCell>
                <TableCell className="text-right">₹{breakdown?.basic?.toLocaleString() || 0}</TableCell>
              </TableRow>
              {breakdown?.allowances && Object.entries(breakdown.allowances).map(([key, value]: [string, unknown]) => (
                <TableRow key={key}>
                  <TableCell>{key}</TableCell>
                  <TableCell className="text-right">₹{(value as number).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Gross</TableCell>
                <TableCell className="text-right font-medium">
                  ₹{payslip.gross.toLocaleString()}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>PF (12%)</TableCell>
                <TableCell className="text-right">-₹{payslip.pf.toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Professional Tax</TableCell>
                <TableCell className="text-right">-₹{payslip.professionalTax.toLocaleString()}</TableCell>
              </TableRow>
              <TableRow className="font-bold">
                <TableCell>Net Salary</TableCell>
                <TableCell className="text-right">₹{payslip.net.toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}


