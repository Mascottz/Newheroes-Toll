import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import IssueTicket from './pages/IssueTicket.jsx';
import MySales from './pages/MySales.jsx';
import { LogoMark } from './components/Logo.jsx';

// Admin area (code-split: charts + exporters load only for managers)
const AdminLayout = lazy(() => import('./components/admin/AdminLayout.jsx'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics.jsx'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports.jsx'));
const AdminBalancing = lazy(() => import('./pages/admin/AdminBalancing.jsx'));
const AdminExpenses = lazy(() => import('./pages/admin/AdminExpenses.jsx'));
const StaffAdmin = lazy(() => import('./pages/admin/StaffAdmin.jsx'));

function Splash() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-brand-50">
      <LogoMark size={72} />
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-brand-100">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-500" />
      </div>
    </div>
  );
}

function Protected({ roles }) {
  const { user, booting } = useAuth();
  if (booting) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  const { user, booting } = useAuth();

  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route
          path="/login"
          element={booting ? <Splash /> : user ? <Navigate to="/" replace /> : <Login />}
        />
        <Route element={<Protected />}>
          <Route element={<Layout />}>
            <Route index element={<IssueTicket />} />
            <Route path="my-sales" element={<MySales />} />
          </Route>
        </Route>
        <Route element={<Protected roles={['admin']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminAnalytics />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/balancing" element={<AdminBalancing />} />
            <Route path="/admin/expenses" element={<AdminExpenses />} />
            <Route path="/admin/staff" element={<StaffAdmin />} />
          </Route>
        </Route>
        {/* Legacy paths from v1 */}
        <Route path="/reports" element={<Navigate to="/admin" replace />} />
        <Route path="/staff" element={<Navigate to="/admin/staff" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
