import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { saasApi } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const loginSchema = z.object({
  companyCode: z.string().min(2, 'Company code must be at least 2 characters').max(6, 'Company code must be at most 6 characters'),
  login: z.string().min(1, 'Login (email or login ID) is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function SaasLogin() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { setCompany, refreshCompany } = useBrand();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      const result = await saasApi.login({
        companyCode: data.companyCode.toUpperCase(),
        login: data.login,
        password: data.password,
      });

      // Set company in brand context
      setCompany(result.company);

      // Refresh user data in auth context
      await refreshUser();

      // Refresh company info (to ensure it's up to date)
      await refreshCompany();

      if (result.mustChangePassword) {
        toast.info('Please change your password to continue');
        navigate('/first-login');
      } else {
        toast.success('Logged in successfully!');
        navigate('/');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || 'Login failed';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-violet-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">
            Company Login
          </CardTitle>
          <CardDescription className="text-center">
            Sign in with your company code and credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyCode">Company Code *</Label>
              <Input
                id="companyCode"
                type="text"
                placeholder="WZ"
                {...register('companyCode')}
                disabled={isLoading}
                style={{ textTransform: 'uppercase' }}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  register('companyCode').onChange(e);
                }}
              />
              {errors.companyCode && (
                <p className="text-sm text-destructive">{errors.companyCode.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="login">Login (Email or Login ID) *</Label>
              <Input
                id="login"
                type="text"
                placeholder="Email or Login ID"
                {...register('login')}
                disabled={isLoading}
              />
              {errors.login && (
                <p className="text-sm text-destructive">{errors.login.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground text-center">
            Don't have a company?{' '}
            <Link to="/saas/signup" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Or{' '}
            <Link to="/login" className="text-primary hover:underline">
              use legacy login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

