import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { hrmsApi, getErrorMessage, PayrunStatus } from '@/lib/api';
import { ArrowLeft, RefreshCw, Printer } from 'lucide-react';
import { toast } from 'sonner';

const statusVariants: Record<PayrunStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  computed: 'secondary',
  validated: 'default',
  done: 'default',
  cancelled: 'destructive',
};

export function PayslipDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: payslip, isLoading } = useQuery({
    queryKey: ['payroll', 'payslips', id],
    queryFn: () => hrmsApi.getPayslipById(id!),
    enabled: !!id,
  });

  const recomputeMutation = useMutation({
    mutationFn: () => hrmsApi.recomputePayslip(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payslips', id] });
      toast.success('Payslip recomputed');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatMonth = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="space-y-6 p-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <p className="text-center text-muted-foreground py-8">Payslip not found</p>
      </div>
    );
  }

  const components = payslip.components as any;
  const allowances = components?.allowances || {};

  return (
    <>
      {/* Print-only header */}
      <div className="hidden print:block print:mb-6 print:border-b print:pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold print:text-black">
              {payslip.employee?.userName || 'Payslip Detail'}
            </h1>
            <p className="text-sm print:text-gray-600 mt-1">
              {payslip.employee?.code} • {formatMonth(payslip.periodMonth)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm print:text-gray-600">WorkZen HRMS</p>
            <p className="text-xs print:text-gray-500">{new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6 print:p-0 print:space-y-4 payslip-content">
        <div className="print:hidden">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="flex items-start justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold">
              {payslip.employee?.userName || 'Payslip Detail'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {payslip.employee?.code} • {formatMonth(payslip.periodMonth)}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
          <Badge variant={statusVariants[payslip.status]}>
            {payslip.status.toUpperCase()}
          </Badge>
          {payslip.status !== 'done' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm('Recompute this payslip?')) {
                  recomputeMutation.mutate();
                }
              }}
              disabled={recomputeMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recompute
            </Button>
          )}
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Panel */}
      <Card className="print:border print:shadow-none">
        <CardHeader className="print:border-b print:pb-2 print:mb-2">
          <CardTitle className="print:text-black print:text-lg">Payslip Summary</CardTitle>
        </CardHeader>
        <CardContent className="print:p-4">
          <div className="grid grid-cols-2 gap-4 print:gap-2">
            <div>
              <p className="text-sm text-muted-foreground print:text-gray-600">Employee</p>
              <p className="font-semibold print:text-black">{payslip.employee?.userName}</p>
              <p className="text-sm text-muted-foreground print:text-gray-600">{payslip.employee?.userEmail}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground print:text-gray-600">Period</p>
              <p className="font-semibold print:text-black">{formatMonth(payslip.periodMonth)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground print:text-gray-600">Designation</p>
              <p className="font-semibold print:text-black">{payslip.employee?.title || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground print:text-gray-600">Employee ID</p>
              <p className="font-semibold print:text-black">{payslip.employee?.code}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worked Days */}
      <Card className="print:border print:shadow-none">
        <CardHeader className="print:border-b print:pb-2 print:mb-2">
          <CardTitle className="print:text-black print:text-lg">Worked Days</CardTitle>
        </CardHeader>
        <CardContent className="print:p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Attendance</TableCell>
                <TableCell className="text-right">{components?.presentDays || 0}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(payslip.attendanceDaysAmount)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Paid Time Off</TableCell>
                <TableCell className="text-right">{components?.paidLeaveDays || 0}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(payslip.paidLeaveDaysAmount)}
                </TableCell>
              </TableRow>
              <TableRow className="font-semibold bg-muted/50 print:bg-transparent">
                <TableCell className="print:text-black">Total Payable Days</TableCell>
                <TableCell className="text-right print:text-black">
                  {payslip.payableDays} / {payslip.totalWorkingDays}
                </TableCell>
                <TableCell className="text-right print:text-black">{formatCurrency(payslip.gross)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-2 print:text-gray-600">
            Daily Rate: {formatCurrency(components?.dailyRate || 0)} 
            {' '}(₹{payslip.monthlyWage} / {payslip.totalWorkingDays} working days)
          </p>
        </CardContent>
      </Card>

      {/* Salary Computation */}
      <Card className="print:border print:shadow-none">
        <CardHeader className="print:border-b print:pb-2 print:mb-2">
          <CardTitle className="print:text-black print:text-lg">Salary Computation</CardTitle>
        </CardHeader>
        <CardContent className="print:p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="font-semibold">
                <TableCell colSpan={2}>Earnings</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Basic Salary</TableCell>
                <TableCell className="text-right">{formatCurrency(payslip.basic)}</TableCell>
              </TableRow>
              {Object.entries(allowances).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell className="pl-8">{key}</TableCell>
                  <TableCell className="text-right">{formatCurrency(value as number)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold bg-muted/30 print:bg-transparent">
                <TableCell className="print:text-black">Monthly Wage</TableCell>
                <TableCell className="text-right print:text-black">{formatCurrency(payslip.monthlyWage)}</TableCell>
              </TableRow>
              <TableRow className="font-semibold bg-green-50 print:bg-transparent">
                <TableCell className="print:text-black">Gross Pay</TableCell>
                <TableCell className="text-right text-green-600 print:text-black">
                  {formatCurrency(payslip.gross)}
                </TableCell>
              </TableRow>
              <TableRow className="font-semibold">
                <TableCell colSpan={2} className="pt-4 print:text-black">Deductions</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 print:text-black">PF Employee (12%)</TableCell>
                <TableCell className="text-right text-red-600 print:text-black">
                  {formatCurrency(payslip.pfEmployee)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 print:text-black">Professional Tax</TableCell>
                <TableCell className="text-right text-red-600 print:text-black">
                  {formatCurrency(payslip.professionalTax)}
                </TableCell>
              </TableRow>
              <TableRow className="font-bold text-lg bg-blue-50 print:bg-transparent">
                <TableCell className="print:text-black">Net Pay</TableCell>
                <TableCell className="text-right text-blue-600 print:text-black print:font-bold">
                  {formatCurrency(payslip.net)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm print:bg-transparent print:border print:p-2">
            <p className="font-semibold print:text-black">Employer Contribution:</p>
            <p className="text-muted-foreground print:text-gray-700">
              PF Employer: {formatCurrency(payslip.pfEmployer)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          
          /* Hide everything by default */
          body * {
            visibility: hidden;
          }
          
          /* Show only payslip content */
          .payslip-content,
          .payslip-content * {
            visibility: visible;
          }
          
          /* Hide non-printable elements */
          .print\\:hidden,
          nav,
          aside,
          header:not(.print-header),
          footer {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Show print-only elements */
          .print\\:block {
            display: block !important;
            visibility: visible !important;
          }
          
          /* Reset card styles for print */
          .payslip-content [class*="Card"],
          .payslip-content [class*="card"] {
            border: 1px solid #e5e7eb !important;
            box-shadow: none !important;
            page-break-inside: avoid;
            margin-bottom: 1rem;
          }
          
          /* Ensure tables print properly */
          .payslip-content table {
            width: 100%;
            border-collapse: collapse;
          }
          
          .payslip-content table th,
          .payslip-content table td {
            border: 1px solid #d1d5db !important;
            padding: 0.5rem !important;
          }
          
          /* Remove background colors for print */
          .payslip-content [class*="bg-"] {
            background-color: transparent !important;
          }
          
          /* Ensure text is black for print */
          .payslip-content {
            color: #000 !important;
          }
          
          .payslip-content h1,
          .payslip-content h2,
          .payslip-content h3 {
            color: #000 !important;
          }
          
          /* Prevent page breaks inside important sections */
          .payslip-content [class*="Card"] {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
    </>
  );
}

