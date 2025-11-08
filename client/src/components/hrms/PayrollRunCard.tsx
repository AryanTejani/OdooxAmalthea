import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hrmsApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { DollarSign } from 'lucide-react';

export function PayrollRunCard() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [generatedSummary, setGeneratedSummary] = useState<any>(null);

  const generateMutation = useMutation({
    mutationFn: (month: string) => hrmsApi.generatePayrun(month),
    onSuccess: (data) => {
      setGeneratedSummary(data);
      queryClient.invalidateQueries({ queryKey: ['payruns'] });
      toast.success('Payrun generated successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: (payrunId: string) => hrmsApi.finalizePayrun(payrunId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payruns'] });
      toast.success('Payrun finalized successfully!');
      setGeneratedSummary(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate(month);
  };

  const handleFinalize = () => {
    if (generatedSummary?.payrunId) {
      finalizeMutation.mutate(generatedSummary.payrunId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Generate Payrun
        </CardTitle>
        <CardDescription>Generate payroll for a specific month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="w-full"
        >
          {generateMutation.isPending ? 'Generating...' : 'Generate Payrun'}
        </Button>

        {generatedSummary && (
          <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Employees:</span>
              <span className="text-sm font-medium">{generatedSummary.employeeCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Gross:</span>
              <span className="text-sm font-medium">
                ₹{generatedSummary.totalGross.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Net:</span>
              <span className="text-sm font-medium">
                ₹{generatedSummary.totalNet.toLocaleString()}
              </span>
            </div>
            {generatedSummary.status === 'DRAFT' && (
              <Button
                onClick={handleFinalize}
                disabled={finalizeMutation.isPending}
                className="w-full mt-2"
                variant="destructive"
              >
                {finalizeMutation.isPending ? 'Finalizing...' : 'Finalize Payrun'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


