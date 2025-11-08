import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/auth/AuthContext';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { queryClient } from '@/lib/queryClient';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Profile } from '@/pages/Profile';
import { FirstLogin } from '@/pages/FirstLogin';
import { Dashboard } from '@/pages/hrms/Dashboard';
import { Attendance } from '@/pages/hrms/Attendance';
import { Leave } from '@/pages/hrms/Leave';
import { LeaveApprovals } from '@/pages/hrms/LeaveApprovals';
import { Payroll } from '@/pages/hrms/Payroll';
import { Employees } from '@/pages/hrms/Employees';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/hrms/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/first-login"
              element={
                <ProtectedRoute>
                  <FirstLogin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/attendance"
              element={
                <ProtectedRoute>
                  <Attendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/leave"
              element={
                <ProtectedRoute>
                  <Leave />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/leave/approvals"
              element={
                <ProtectedRoute>
                  <LeaveApprovals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/payroll"
              element={
                <ProtectedRoute>
                  <Payroll />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/employees"
              element={
                <ProtectedRoute>
                  <Employees />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/hrms/dashboard" replace />} />
          </Routes>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

