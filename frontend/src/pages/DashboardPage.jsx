import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Bed, GitBranch, Activity, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import api from '../lib/api';

function StatCard({ icon: Icon, value, label, color, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--color-text-faint)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function BedBar({ bedSummary }) {
  const typeMap = {};
  (bedSummary || []).forEach(({ bedType, status, _count }) => {
    if (!typeMap[bedType]) typeMap[bedType] = { AVAILABLE: 0, OCCUPIED: 0, MAINTENANCE: 0, RESERVED: 0 };
    typeMap[bedType][status] = _count.id;
  });

  const colors = { AVAILABLE: 'var(--color-success)', OCCUPIED: 'var(--color-danger)', MAINTENANCE: 'var(--color-warning)', RESERVED: 'var(--color-accent)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Object.entries(typeMap).map(([type, counts]) => {
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return (
          <div key={type}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{type}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{counts.OCCUPIED}/{total} occupied</span>
            </div>
            <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'var(--color-surface-2)', overflow: 'hidden', display: 'flex' }}>
              {Object.entries(counts).map(([status, count]) => count > 0 && (
                <div key={status} style={{ width: `${(count / total) * 100}%`, background: colors[status], transition: 'width 0.4s' }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [sysStats, setSysStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // For demo, use first hospital from system stats
  const hospitalId = user?.hospitalAdmin?.hospitalId;
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const load = async () => {
      try {
        if (isAdmin) {
          const { data } = await api.get('/dashboard/system');
          setSysStats(data);
        }
        if (hospitalId) {
          const { data } = await api.get(`/dashboard/hospital/${hospitalId}`);
          setStats(data);
        }
      } catch { } finally { setLoading(false); }
    };
    load();
  }, [hospitalId, isAdmin]);

  if (loading) return <div className="loading"><div className="spinner" /> Loading dashboard...</div>;

  const d = stats || {};
  const s = sysStats || {};

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back{user?.doctor?.name ? `, ${user.doctor.name}` : ''} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {isAdmin && (
        <>
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>System Overview</div>
          <div className="grid-4" style={{ marginBottom: 32 }}>
            <StatCard icon={Users} value={s.hospitals} label="Active Hospitals" color="var(--color-accent)" />
            <StatCard icon={Users} value={s.doctors} label="Doctors" color="var(--color-primary)" />
            <StatCard icon={Users} value={s.patients} label="Total Patients" color="var(--color-warning)" />
            <StatCard icon={Activity} value={s.visits} label="Total Visits" color="var(--color-success)" />
          </div>
        </>
      )}

      <div className="grid-4" style={{ marginBottom: 32 }}>
        <StatCard icon={Users} value={d.patients?.total} label="Registered Patients" color="var(--color-accent)" sub={`${d.patients?.activeAdmissions || 0} admitted`} />
        <StatCard icon={Bed} value={d.beds?.filter?.(b => b.status === 'OCCUPIED').reduce?.((a, b) => a + b._count.id, 0)} label="Beds Occupied" color="var(--color-danger)" />
        <StatCard icon={GitBranch} value={d.referrals?.pending} label="Pending Referrals" color="var(--color-warning)" sub={`${d.referrals?.incoming || 0} incoming`} />
        <StatCard icon={Calendar} value={d.appointments?.today} label="Today's Appointments" color="var(--color-success)" />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Bed Occupancy by Ward</h3>
          {d.beds?.length ? <BedBar bedSummary={d.beds} /> : (
            <div className="empty-state" style={{ padding: 30 }}>
              <Bed size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13 }}>No bed data yet</p>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} style={{ color: 'var(--color-warning)' }} /> Alerts & Notifications
            </span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.inventory?.lowStockCount > 0 && (
              <div style={{ padding: '12px 14px', background: 'var(--color-warning-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 13 }}>
                ⚠️ {d.inventory.lowStockCount} medicine(s) below reorder level
              </div>
            )}
            {d.referrals?.pending > 0 && (
              <div style={{ padding: '12px 14px', background: 'var(--color-danger-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,77,109,0.2)', fontSize: 13 }}>
                🔴 {d.referrals.pending} referral(s) pending acceptance
              </div>
            )}
            {!d.inventory?.lowStockCount && !d.referrals?.pending && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                ✅ No critical alerts
              </div>
            )}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>QUICK STATS</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Today\'s visits', d.visits?.today ?? '—'],
                ['This week\'s visits', d.visits?.thisWeek ?? '—'],
                ['Available doctors', d.doctors?.available ?? '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
