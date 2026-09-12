import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Bed, GitBranch, Calendar,
  Activity, UserCheck, Package, Settings, LogOut, Heart,
  Stethoscope,
} from 'lucide-react';

const NAV = [
  { section: 'Overview', items: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ]},
  { section: 'Patients', items: [
    { to: '/patients', icon: Users, label: 'Patients' },
    { to: '/visits/new', icon: Stethoscope, label: 'New Visit' },
    { to: '/triage', icon: Activity, label: 'Triage' },
  ]},
  { section: 'Hospital', items: [
    { to: '/beds', icon: Bed, label: 'Beds & Wards' },
    { to: '/referrals', icon: GitBranch, label: 'Referrals' },
    { to: '/appointments', icon: Calendar, label: 'Appointments' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
  ]},
  { section: 'Field', items: [
    { to: '/asha', icon: UserCheck, label: 'ASHA Portal' },
  ]},
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Heart size={20} style={{ color: 'var(--color-primary)' }} />
            <h2>Aspatal</h2>
          </div>
          <span>Rural Healthcare Platform</span>
        </div>

        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}

          {user?.role === 'ADMIN' && (
            <div>
              <div className="nav-section">Admin</div>
              <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Settings size={16} /> Admin Panel
              </NavLink>
            </div>
          )}
        </nav>

        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ padding: '10px 12px', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.patient?.name || user?.doctor?.name || user?.email || 'User'}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
          <button className="nav-item btn-ghost" onClick={handleLogout} style={{ width: '100%' }}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
