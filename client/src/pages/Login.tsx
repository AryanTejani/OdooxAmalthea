import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
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
import { GoogleButton } from '@/components/GoogleButton';

const loginSchema = z.object({
  login: z.string().min(1, 'Login ID or Email is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Show OAuth error if present
  const oauthError = searchParams.get('error');
  if (oauthError === 'oauth_failed') {
    toast.error('OAuth authentication failed. Please try again.');
    // Clear the error from URL
    window.history.replaceState({}, '', '/login');
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      const result = await login(data.login, data.password);
      if (result.mustChangePassword) {
        toast.info('Please change your password to continue');
        navigate('/first-login');
      } else {
        toast.success('Logged in successfully!');
        navigate('/hrms/dashboard');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-violet-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">
            Welcome back
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login">Login ID / Email</Label>
              <Input
                id="login"
                type="text"
                placeholder="Login ID or Email"
                {...register('login')}
                disabled={isLoading}
              />
              {errors.login && (
                <p className="text-sm text-destructive">{errors.login.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <GoogleButton disabled={isLoading} />
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground text-center">
            Accounts are created by HR/Admin. Contact your administrator for access.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

