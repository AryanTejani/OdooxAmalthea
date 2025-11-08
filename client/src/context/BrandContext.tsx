import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';

export interface Company {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
}

interface BrandContextType {
  company: Company | null;
  isLoading: boolean;
  setCompany: (company: Company | null) => void;
  refreshCompany: () => Promise<void>;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const refreshCompany = useCallback(async () => {
    if (!user) {
      setCompany(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.get<{ company: Company }>('/api/company/me');
      setCompany(response.data.company);
    } catch (error: any) {
      // If not authenticated (401), no company (403), or not found (404), set to null
      // These are expected in some cases (e.g., user not yet assigned to a company)
      const status = error?.response?.status;
      if (status === 401 || status === 403 || status === 404) {
        // Expected errors - user might not have a company yet
        setCompany(null);
      } else {
        // Unexpected error - log it but still set company to null to prevent UI crashes
        console.error('Error fetching company:', error);
        setCompany(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Refresh company info when user changes
    refreshCompany();
  }, [refreshCompany]);

  return (
    <BrandContext.Provider value={{ company, isLoading, setCompany, refreshCompany }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}

