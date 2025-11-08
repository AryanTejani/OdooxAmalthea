import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export function UserAvatarDropdown() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleProfile = () => {
    navigate('/profile');
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full"
        >
          <div className="h-10 w-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold text-sm">
            {user?.name ? getInitials(user.name) : 'U'}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleProfile}>
          <User className="mr-2 h-4 w-4" />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

