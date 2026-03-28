import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './layout/Layout';
import TreePage from './pages/TreePage';
import PersonPage from './pages/PersonPage';
import StatsPage from './pages/StatsPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import SearchPage from './pages/SearchPage';
import RelationshipPage from './pages/RelationshipPage';
import NotificationsPage from './pages/NotificationsPage';
import FundPage from './pages/FundPage';
import EventCalculatorPage from './pages/EventCalculatorPage';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/" element={<TreePage />} />
            <Route path="/person/:id" element={<PersonPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/relationship" element={<RelationshipPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/fund" element={<FundPage />} />
            <Route path="/admin/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
            <Route path="/admin/event-calculator" element={<RequireAdmin><EventCalculatorPage /></RequireAdmin>} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
