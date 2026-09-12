import { useEffect, useState } from 'react';
import { GitBranch, ArrowRight } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const STATUS_FLOW = ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'];
const STATUS_COLORS = {
  PENDING: 'badge-warning', ACCEPTED: 'badge-accent',
  IN_TRANSIT: 'badge-primary', COMPLETED: 'badge-success', CANCELLED: 'badge-neutral',
};
const NEXT_STATUS = { PENDING: 'ACCEPTED', ACCEPTED: 'IN_TRANSIT', IN_TRANSIT: 'COMPLETED' };

export default function ReferralsPage() {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const hospitalId = user?.hospitalAdmin?.hospitalId || 'seed-hospital-1';

  useEffect(() => {
    api.get(`/referrals/hospital/${hospitalId}`)
      .then(({ data }) => setReferrals(data))
      .finally(() => setLoading(false));
  }, [hospitalId]);

  const advance = async (id, status) => {
    try {
      const { data } = await api.patch(`/referrals/${id}/status`, { status });
      setReferrals(prev => prev.map(r => r.id === id ? data : r));
    } catch (err) { alert(err.response?.data?.error || 'Failed to update'); }
  };

  const filtered = filter === 'ALL' ? referrals : referrals.filter(r => r.status === filter);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1>Referrals</h1>
        <p>Track inter-facility patient referrals and their completion status</p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['ALL', ...STATUS_FLOW].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}>
            {s} {s !== 'ALL' && `(${referrals.filter(r => r.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : filtered.length === 0 ? (
        <div className="empty-state"><GitBranch size={36} style={{ opacity: 0.3, margin: '0 auto 12px' }} /><h3>No referrals</h3></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(r => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{r.patient?.name}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 13, marginLeft: 8 }}>
                    {r.fromHospital?.name} <ArrowRight size={12} style={{ margin: '0 4px', verticalAlign: 'middle' }} /> {r.toHospital?.name}
                  </span>
                </div>
                <span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status.replace('_', ' ')}</span>
              </div>

              {/* Progress bar */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {STATUS_FLOW.slice(0, 4).map((s, i) => {
                  const idx = STATUS_FLOW.indexOf(r.status);
                  const done = idx >= i;
                  return (
                    <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: done ? 'var(--color-primary)' : 'var(--color-surface-2)', transition: 'background 0.3s' }} />
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12, flexWrap: 'wrap' }}>
                <span>By: {r.referredBy?.name}</span>
                <span>Reason: {r.reason}</span>
                <span>Date: {new Date(r.referredAt).toLocaleDateString('en-IN')}</span>
              </div>

              {NEXT_STATUS[r.status] && (
                <button className="btn btn-secondary btn-sm" onClick={() => advance(r.id, NEXT_STATUS[r.status])}>
                  Mark as {NEXT_STATUS[r.status].replace('_', ' ')} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
