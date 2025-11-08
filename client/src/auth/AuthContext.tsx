import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, User, getErrorMessage } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  mustChangePassword: boolean;
  login: (login: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Fetch current user on mount
  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await authApi.getMe();
      setUser(currentUser);
      setMustChangePassword(currentUser.mustChangePassword ?? false);
      setError(null);
    } catch (err) {
      // Not authenticated - that's okay
      setUser(null);
      setMustChangePassword(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authApi.getMe();
      setUser(currentUser);
      setMustChangePassword(currentUser.mustChangePassword ?? false);
    } catch (err) {
      setUser(null);
      setMustChangePassword(false);
    }
  }, []);

  // Silent refresh every 10 minutes
  useEffect(() => {
    const refreshInterval = setInterval(
      async () => {
        if (user) {
          try {
            await authApi.refresh();
            // Optionally refresh user data
            await refreshUser();
          } catch (err) {
            console.error('Silent refresh failed:', err);
            // Don't log out immediately - let the next request handle it
          }
        }
      },
      10 * 60 * 1000
    ); // 10 minutes

    return () => clearInterval(refreshInterval);
  }, [user, refreshUser]);

  // Initial load
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Login
  const login = async (login: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await authApi.login({ login, password });
      setUser(result.user);
      setMustChangePassword(result.mustChangePassword);
      return { mustChangePassword: result.mustChangePassword };
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // Change password
  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      const updatedUser = await authApi.changePassword({ currentPassword, newPassword });
      setUser(updatedUser);
      setMustChangePassword(false);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // Register
  const register = async (email: string, name: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const newUser = await authApi.register({ email, name, password });
      setUser(newUser);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      setLoading(true);
      await authApi.logout();
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
      // Clear user anyway
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        mustChangePassword,
        login,
        register,
        logout,
        refreshUser,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

