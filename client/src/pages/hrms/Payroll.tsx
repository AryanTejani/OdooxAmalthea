import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PayrollRunCard } from '@/components/hrms/PayrollRunCard';
import { PayslipModal } from '@/components/hrms/PayslipModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hrmsApi, Payslip } from '@/lib/api';

export function Payroll() {
  const [selectedPayrunId, setSelectedPayrunId] = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);

  const { data: payruns } = useQuery({
    queryKey: ['payruns'],
    queryFn: () => hrmsApi.getPayruns(),
  });

  const { data: payslips } = useQuery({
    queryKey: ['payslips', selectedPayrunId],
    queryFn: () => hrmsApi.getPayslipsByPayrunId(selectedPayrunId!),
    enabled: !!selectedPayrunId,
  });

  const handleViewPayslips = (payrunId: string) => {
    setSelectedPayrunId(payrunId);
  };

  const handleViewPayslip = async (payslipId: string) => {
    try {
      const payslip = await hrmsApi.getPayslipById(payslipId);
      setSelectedPayslip(payslip);
      setPayslipModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch payslip:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Payroll</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <PayrollRunCard />
        
        <Card>
          <CardHeader>
            <CardTitle>Payruns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payruns && payruns.length > 0 ? (
                payruns.map((payrun) => (
                  <div
                    key={payrun.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{payrun.month}</p>
                      <Badge variant={payrun.status === 'FINALIZED' ? 'default' : 'outline'}>
                        {payrun.status}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleViewPayslips(payrun.id)}
                      variant="outline"
                    >
                      View Payslips
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No payruns found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedPayrunId && payslips && (
        <Card>
          <CardHeader>
            <CardTitle>Payslips - {payruns?.find((p) => p.id === selectedPayrunId)?.month}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>PF</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.length > 0 ? (
                  payslips.map((payslip) => (
                    <TableRow key={payslip.id}>
                      <TableCell>{payslip.employeeId}</TableCell>
                      <TableCell>₹{payslip.gross.toLocaleString()}</TableCell>
                      <TableCell>₹{payslip.pf.toLocaleString()}</TableCell>
                      <TableCell>₹{payslip.professionalTax.toLocaleString()}</TableCell>
                      <TableCell className="font-medium">₹{payslip.net.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleViewPayslip(payslip.id)}
                          variant="outline"
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No payslips found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PayslipModal
        open={payslipModalOpen}
        onOpenChange={setPayslipModalOpen}
        payslip={selectedPayslip}
      />
    </div>
  );
}


