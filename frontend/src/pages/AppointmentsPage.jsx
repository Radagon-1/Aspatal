import { useEffect, useState } from 'react';
import { Calendar, Hash } from 'lucide-react';
import api from '../lib/api';

const STATUS_COLOR = { SCHEDULED: 'badge-neutral', CHECKED_IN: 'badge-accent', IN_PROGRESS: 'badge-primary', COMPLETED: 'badge-success', CANCELLED: 'badge-neutral', NO_SHOW: 'badge-danger' };

export default function AppointmentsPage() {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    api.get('/doctors').then(({ data }) => {
      const list = data.data || [];
      setDoctors(list);
      if (list.length) setDoctorId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!doctorId) return;
    setLoading(true);
    api.get(`/appointments/doctor/${doctorId}?date=${date}`)
      .then(({ data }) => setAppointments(data))
      .finally(() => setLoading(false));
  }, [doctorId, date]);

  const updateStatus = async (id, status) => {
    await api.patch(`/appointments/${id}/status`, { status });
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const inProgress = appointments.filter(a => ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS'].includes(a.status));
  const done = appointments.filter(a => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status));

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1>Appointments & Queue</h1>
        <p>Manage daily doctor queues and appointment tokens</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="grid-2" style={{ gap: 16 }}>
          <div className="form-group">
            <label className="label">Doctor</label>
            <select className="input" value={doctorId} onChange={e => setDoctorId(e.target.value)}>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <>
          {inProgress.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Today's Queue ({inProgress.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {inProgress.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-display)', fontSize: 16, flexShrink: 0 }}>
                      {a.tokenNumber}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{a.patient?.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{a.timeSlot} · {a.reason || 'General consultation'}</div>
                    </div>
                    <span className={`badge ${STATUS_COLOR[a.status]}`}>{a.status.replace('_', ' ')}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {a.status === 'SCHEDULED' && <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(a.id, 'CHECKED_IN')}>Check In</button>}
                      {a.status === 'CHECKED_IN' && <button className="btn btn-primary btn-sm" onClick={() => updateStatus(a.id, 'IN_PROGRESS')}>Start</button>}
                      {a.status === 'IN_PROGRESS' && <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(a.id, 'COMPLETED')}>Done</button>}
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => updateStatus(a.id, 'CANCELLED')}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {appointments.length === 0 && <div className="empty-state"><Calendar size={36} style={{ opacity: 0.3, margin: '0 auto 12px' }} /><h3>No appointments for this date</h3></div>}

          {done.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>Completed ({done.length})</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Token</th><th>Patient</th><th>Time</th><th>Status</th></tr></thead>
                  <tbody>
                    {done.map(a => (
                      <tr key={a.id}>
                        <td><span className="badge badge-neutral"><Hash size={10} />{a.tokenNumber}</span></td>
                        <td>{a.patient?.name}</td>
                        <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{a.timeSlot}</td>
                        <td><span className={`badge ${STATUS_COLOR[a.status]}`}>{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
