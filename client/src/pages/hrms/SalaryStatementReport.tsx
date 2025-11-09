import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { reportsApi } from '@/lib/api';
import { useBrand } from '@/context/BrandContext';
import { Printer, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui-ext/EmptyState';
import { FileText } from 'lucide-react';

interface SalaryComponent {
  key: string;
  monthly: number;
  yearly: number;
}

interface SalaryStatementData {
  employee: {
    id: string;
    name: string;
    title: string | null;
    dateOfJoining: string | null;
    salaryEffectiveFrom: string | null;
  };
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  netSalary: {
    monthly: number;
    yearly: number;
  };
  estimatedMonths: string[];
}

export function SalaryStatementReport() {
  const { company } = useBrand();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [reportData, setReportData] = useState<SalaryStatementData | null>(null);

  // Get current year and last 3 years
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  // Fetch employees for dropdown
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['reportEmployees'],
    queryFn: () => reportsApi.getReportEmployees(),
  });

  // Fetch salary statement when employee and year are selected
  const { data: statementData, isLoading: statementLoading, error: statementError } = useQuery({
    queryKey: ['salaryStatement', selectedEmployeeId, selectedYear],
    queryFn: () => reportsApi.getSalaryStatement(selectedEmployeeId, selectedYear),
    enabled: !!selectedEmployeeId && !!selectedYear,
  });

  useEffect(() => {
    if (statementData) {
      setReportData(statementData);
    }
  }, [statementData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handlePrint = () => {
    window.print();
  };

  const canPrint = !!selectedEmployeeId && !!selectedYear && !!reportData;

  return (
    <>
      <style>{`
        @media print {
          @page {
            margin: 1cm;
            size: A4;
          }

          body * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          /* Hide non-printable elements */
          header,
          nav,
          button,
          .print\\:hidden {
            display: none !important;
          }

          /* Adjust layout for print */
          .space-y-6 {
            margin-top: 1rem !important;
          }

          /* Card styling for print */
          .print\\:shadow-none {
            box-shadow: none !important;
          }

          .print\\:border-0 {
            border: none !important;
          }

          /* Text sizing for print */
          .print\\:text-xs {
            font-size: 0.75rem !important;
            line-height: 1rem !important;
          }

          .print\\:text-sm {
            font-size: 0.875rem !important;
            line-height: 1.25rem !important;
          }

          .print\\:text-lg {
            font-size: 1.125rem !important;
            line-height: 1.75rem !important;
          }

          /* Spacing for print */
          .print\\:p-4 {
            padding: 1rem !important;
          }

          .print\\:mb-4 {
            margin-bottom: 1rem !important;
          }

          .print\\:mb-2 {
            margin-bottom: 0.5rem !important;
          }

          .print\\:gap-2 {
            gap: 0.5rem !important;
          }

          /* Colors for print */
          .print\\:bg-gray-100 {
            background-color: #f3f4f6 !important;
          }

          .print\\:text-gray-600 {
            color: #4b5563 !important;
          }

          .print\\:border-t {
            border-top-width: 1px !important;
          }

          .print\\:border-black {
            border-color: #000 !important;
          }

          /* Full width for print */
          .lg\\:col-span-2 {
            grid-column: span 3 / span 3 !important;
          }
        }
      `}</style>
      <div className="space-y-6">
      {/* Header with Print Button */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Salary Statement Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate salary statements for employees
          </p>
        </div>
        <Button
          onClick={handlePrint}
          disabled={!canPrint}
          className="print:hidden"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Select Employee & Year</CardTitle>
            <CardDescription>Choose an employee and year to generate the report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Employee Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee</label>
              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
                disabled={employeesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeesLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : employees && employees.length > 0 ? (
                    employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name} {employee.title ? `- ${employee.title}` : ''}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No employees found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Year Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Year</label>
              <Select
                value={String(selectedYear)}
                onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Report View */}
        <div className="lg:col-span-2">
          {statementLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : statementError ? (
            <Card>
              <CardContent className="py-12">
                <EmptyState
                  icon={<FileText className="h-12 w-12 text-muted-foreground" />}
                  title="Error loading report"
                  subtitle={statementError instanceof Error ? statementError.message : 'Failed to load salary statement'}
                />
              </CardContent>
            </Card>
          ) : !reportData ? (
            <Card>
              <CardContent className="py-12">
                <EmptyState
                  icon={<FileText className="h-12 w-12 text-muted-foreground" />}
                  title="No data selected"
                  subtitle="Please select an employee and year to generate the report"
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-6 print:p-4">
                {/* Company Header */}
                <div className="mb-6 print:mb-4">
                  <div className="flex items-center gap-4 mb-2">
                    {company?.logoUrl ? (
                      <img
                        src={company.logoUrl}
                        alt={company.name}
                        className="h-12 w-12 rounded-lg object-cover print:h-10 print:w-10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div>
                      <h2 className="text-xl font-semibold print:text-lg">{company?.name || 'Company'}</h2>
                      <p className="text-sm text-muted-foreground print:text-xs">Salary Statement Report</p>
                    </div>
                  </div>
                </div>

                {/* Employee Meta */}
                <div className="mb-6 print:mb-4 space-y-2 print:space-y-1">
                  <div className="grid grid-cols-2 gap-4 print:gap-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground print:text-xs">Employee Name</p>
                      <p className="text-base print:text-sm">{reportData.employee.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground print:text-xs">Designation</p>
                      <p className="text-base print:text-sm">{reportData.employee.title || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground print:text-xs">Date of Joining</p>
                      <p className="text-base print:text-sm">
                        {reportData.employee.dateOfJoining
                          ? new Date(reportData.employee.dateOfJoining).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground print:text-xs">Salary Effective From</p>
                      <p className="text-base print:text-sm">
                        {reportData.employee.salaryEffectiveFrom
                          ? new Date(reportData.employee.salaryEffectiveFrom).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Salary Statement Table */}
                <div className="mb-4 print:mb-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px] print:text-xs">Component</TableHead>
                        <TableHead className="text-right print:text-xs">Monthly Amount</TableHead>
                        <TableHead className="text-right print:text-xs">Yearly Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Earnings Section */}
                      <TableRow className="bg-muted/50 print:bg-gray-100">
                        <TableCell colSpan={3} className="font-semibold print:text-xs">
                          Earnings
                        </TableCell>
                      </TableRow>
                      {reportData.earnings.map((earning) => (
                        <TableRow key={earning.key}>
                          <TableCell className="print:text-xs">{earning.key}</TableCell>
                          <TableCell className="text-right print:text-xs">
                            {formatCurrency(earning.monthly)}
                          </TableCell>
                          <TableCell className="text-right print:text-xs">
                            {formatCurrency(earning.yearly)}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Deductions Section */}
                      <TableRow className="bg-muted/50 print:bg-gray-100">
                        <TableCell colSpan={3} className="font-semibold print:text-xs">
                          Deductions
                        </TableCell>
                      </TableRow>
                      {reportData.deductions.map((deduction) => (
                        <TableRow key={deduction.key}>
                          <TableCell className="print:text-xs">{deduction.key}</TableCell>
                          <TableCell className="text-right print:text-xs">
                            {formatCurrency(deduction.monthly)}
                          </TableCell>
                          <TableCell className="text-right print:text-xs">
                            {formatCurrency(deduction.yearly)}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Net Salary */}
                      <TableRow className="border-t-2 border-foreground font-semibold print:border-t print:border-black">
                        <TableCell className="print:text-xs">Net Salary</TableCell>
                        <TableCell className="text-right print:text-xs">
                          {formatCurrency(reportData.netSalary.monthly)}
                        </TableCell>
                        <TableCell className="text-right print:text-xs">
                          {formatCurrency(reportData.netSalary.yearly)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Estimated Months Footnote */}
                {reportData.estimatedMonths.length > 0 && (
                  <p className="text-sm text-muted-foreground print:text-xs print:text-gray-600">
                    *Estimated for months: {reportData.estimatedMonths.join(', ')} (no finalized payslip).
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

