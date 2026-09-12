import { useEffect, useState } from 'react';
import { Shield, Users, Hospital, Activity } from 'lucide-react';
import api from '../lib/api';

export default function AdminPage() {
  const [sysStats, setSysStats] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/system'),
      api.get('/hospitals?limit=50'),
    ]).then(([sys, hosp]) => {
      setSysStats(sys.data);
      setHospitals(hosp.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const LEVEL_COLORS = {
    SUB_CENTRE: 'badge-neutral', PHC: 'badge-accent', CHC: 'badge-primary',
    RURAL_HOSPITAL: 'badge-warning', DISTRICT_HOSPITAL: 'badge-success', TERTIARY: 'badge-danger',
  };

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Shield size={24} style={{ color: 'var(--color-primary)' }} />
        <div><h1>Admin Panel</h1><p>System-wide management — super admin access</p></div>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <>
          {/* System Stats */}
          <div className="grid-4" style={{ marginBottom: 28 }}>
            {[
              { label: 'Hospitals', value: sysStats?.hospitals, icon: Activity, color: 'var(--color-primary)' },
              { label: 'Doctors', value: sysStats?.doctors, icon: Users, color: 'var(--color-accent)' },
              { label: 'Patients', value: sysStats?.patients, icon: Users, color: 'var(--color-warning)' },
              { label: 'Total Visits', value: sysStats?.visits, icon: Activity, color: 'var(--color-success)' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card">
                <div className="stat-icon" style={{ background: `${color}18` }}><Icon size={18} style={{ color }} /></div>
                <div><div className="stat-value">{value ?? '—'}</div><div className="stat-label">{label}</div></div>
              </div>
            ))}
          </div>

          {/* Referrals by status */}
          {sysStats?.referralsByStatus?.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Referrals by Status</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {sysStats.referralsByStatus.map(({ status, _count }) => (
                  <div key={status} style={{ padding: '12px 20px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{_count.id}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hospitals table */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Registered Hospitals ({hospitals.length})</h3>
            {hospitals.length === 0 ? (
              <div className="empty-state"><Hospital size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} /><p>No hospitals registered yet</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Hospital</th><th>Location</th><th>Level</th><th>Beds</th><th>Doctors</th></tr></thead>
                  <tbody>
                    {hospitals.map(h => (
                      <tr key={h.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{h.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{h.email || h.phone}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>{h.city}, {h.district}</td>
                        <td><span className={`badge ${LEVEL_COLORS[h.facilityLevel] || 'badge-neutral'}`}>{h.facilityLevel?.replace('_', ' ')}</span></td>
                        <td style={{ fontWeight: 600 }}>{h.totalBeds}</td>
                        <td style={{ fontWeight: 600 }}>{h.totalDoctors ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
