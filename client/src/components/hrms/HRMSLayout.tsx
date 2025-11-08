import { Sidebar } from './Sidebar';

interface HRMSLayoutProps {
  children: React.ReactNode;
}

export function HRMSLayout({ children }: HRMSLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="md:pl-64">
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}

