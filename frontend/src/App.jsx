import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import NewPatientPage from './pages/NewPatientPage';
import BedsPage from './pages/BedsPage';
import ReferralsPage from './pages/ReferralsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import TriagePage from './pages/TriagePage';
import AshaPage from './pages/AshaPage';
import InventoryPage from './pages/InventoryPage';
import AdminPage from './pages/AdminPage';
import NewVisitPage from './pages/NewVisitPage';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role) && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="patients/new" element={<NewPatientPage />} />
            <Route path="patients/:id" element={<PatientDetailPage />} />
            <Route path="visits/new" element={<ProtectedRoute roles={['DOCTOR', 'ADMIN']}><NewVisitPage /></ProtectedRoute>} />
            <Route path="beds" element={<BedsPage />} />
            <Route path="referrals" element={<ReferralsPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="triage" element={<TriagePage />} />
            <Route path="asha" element={<ProtectedRoute roles={['ASHA_WORKER', 'ADMIN']}><AshaPage /></ProtectedRoute>} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="admin" element={<ProtectedRoute roles={['ADMIN']}><AdminPage /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function AuthCallback() {
  const { login } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('accessToken');
  const refreshToken = params.get('refreshToken');
  if (accessToken) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken || '');
    window.location.href = '/dashboard';
  }
  return <div className="loading"><div className="spinner" /> Signing in...</div>;
}
