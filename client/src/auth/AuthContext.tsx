import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, User, getErrorMessage } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user on mount
  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await authApi.getMe();
      setUser(currentUser);
      setError(null);
    } catch (err) {
      // Not authenticated - that's okay
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authApi.getMe();
      setUser(currentUser);
    } catch (err) {
      setUser(null);
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
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const loggedInUser = await authApi.login({ email, password });
      setUser(loggedInUser);
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
        login,
        register,
        logout,
        refreshUser,
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

