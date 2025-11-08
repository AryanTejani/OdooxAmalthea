import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/auth/AuthContext';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { RoleProtectedRoute } from '@/auth/RoleProtectedRoute';
import { HRMSLayout } from '@/components/hrms/HRMSLayout';
import { queryClient } from '@/lib/queryClient';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Profile } from '@/pages/hrms/Profile';
import { FirstLogin } from '@/pages/FirstLogin';
import { Landing } from '@/pages/hrms/Landing';
import { Dashboard } from '@/pages/hrms/Dashboard';
import { AttendanceAdmin } from '@/pages/hrms/AttendanceAdmin';
import { AttendanceMe } from '@/pages/hrms/AttendanceMe';
import { Leave } from '@/pages/hrms/Leave';
import { LeaveApprovals } from '@/pages/hrms/LeaveApprovals';
import { Payroll } from '@/pages/hrms/Payroll';
import { Employees } from '@/pages/hrms/Employees';
import { TimeTracker } from '@/pages/hrms/TimeTracker';
import { Timeline } from '@/pages/hrms/Timeline';
import { TimeLogs } from '@/pages/hrms/TimeLogs';
import { ResetPasswords } from '@/pages/hrms/ResetPasswords';
import { SettingsUsers } from '@/pages/hrms/SettingsUsers';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Landing />
                </ProtectedRoute>
              }
            />
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
                  <HRMSLayout>
                    <Profile />
                  </HRMSLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/dashboard"
              element={
                <ProtectedRoute>
                  <HRMSLayout>
                    <Dashboard />
                  </HRMSLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/attendance"
              element={
                <ProtectedRoute>
                  <HRMSLayout>
                    <AttendanceMe />
                  </HRMSLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/attendance/admin"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'hr', 'payroll']} feature="Attendance Admin">
                  <HRMSLayout>
                    <AttendanceAdmin />
                  </HRMSLayout>
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/hrms/leave"
              element={
                <ProtectedRoute>
                  <HRMSLayout>
                    <Leave />
                  </HRMSLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/leave/approvals"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'hr', 'payroll']} feature="Leave Approvals">
                  <HRMSLayout>
                    <LeaveApprovals />
                  </HRMSLayout>
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/hrms/payroll"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'payroll']} feature="Payroll">
                  <HRMSLayout>
                    <Payroll />
                  </HRMSLayout>
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/hrms/employees"
              element={
                <ProtectedRoute>
                  <HRMSLayout>
                    <Employees />
                  </HRMSLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/time-tracker"
              element={
                <ProtectedRoute>
                  <HRMSLayout>
                    <TimeTracker />
                  </HRMSLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/timeline"
              element={
                <ProtectedRoute>
                  <HRMSLayout>
                    <Timeline />
                  </HRMSLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hrms/time-logs"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'hr', 'payroll']} feature="Time Logs">
                  <HRMSLayout>
                    <TimeLogs />
                  </HRMSLayout>
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/hrms/reset-passwords"
              element={
                <RoleProtectedRoute allowedRoles={['admin']} feature="Reset Passwords">
                  <HRMSLayout>
                    <ResetPasswords />
                  </HRMSLayout>
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/hrms/settings/users"
              element={
                <RoleProtectedRoute allowedRoles={['admin']} feature="User Access Settings">
                  <HRMSLayout>
                    <SettingsUsers />
                  </HRMSLayout>
                </RoleProtectedRoute>
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

