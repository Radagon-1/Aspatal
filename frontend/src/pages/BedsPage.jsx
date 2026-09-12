import { useEffect, useState } from 'react';
import { Bed, Plus, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const BED_COLORS = {
  AVAILABLE: { bg: 'var(--color-success-dim)', border: 'var(--color-success)', text: 'var(--color-success)' },
  OCCUPIED:  { bg: 'var(--color-danger-dim)',  border: 'var(--color-danger)',  text: 'var(--color-danger)'  },
  MAINTENANCE:{ bg: 'var(--color-warning-dim)',border: 'var(--color-warning)', text: 'var(--color-warning)' },
  RESERVED:  { bg: 'var(--color-accent-dim)',  border: 'var(--color-accent)',  text: 'var(--color-accent)'  },
};

const TYPE_ORDER = ['ICU', 'EMERGENCY', 'NICU', 'MATERNITY', 'NORMAL'];

export default function BedsPage() {
  const { user } = useAuth();
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [hospitalId, setHospitalId] = useState('');

  useEffect(() => {
    const hId = user?.hospitalAdmin?.hospitalId || 'seed-hospital-1';
    setHospitalId(hId);
    loadBeds(hId);
  }, [user]);

  const loadBeds = async (hId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/beds/hospital/${hId}`);
      setBeds(data);
    } catch { } finally { setLoading(false); }
  };

  const updateStatus = async (bedId, status) => {
    try {
      await api.patch(`/beds/${bedId}/status`, { status });
      setBeds(prev => prev.map(b => b.id === bedId ? { ...b, status } : b));
    } catch { alert('Failed to update bed status'); }
  };

  const filtered = filter === 'ALL' ? beds : beds.filter(b => b.status === filter);
  const byType = TYPE_ORDER.reduce((acc, t) => {
    const typeBeds = filtered.filter(b => b.bedType === t);
    if (typeBeds.length) acc[t] = typeBeds;
    return acc;
  }, {});

  const summary = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'].map(s => ({
    status: s, count: beds.filter(b => b.status === s).length,
  }));

  return (
    <div className="page fade-in">
      <div className="page-header flex justify-between items-center">
        <div><h1>Bed Management</h1><p>Real-time ward and bed occupancy</p></div>
        <button className="btn btn-secondary btn-sm" onClick={() => loadBeds(hospitalId)}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Summary */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {summary.map(({ status, count }) => {
          const c = BED_COLORS[status];
          return (
            <button key={status} onClick={() => setFilter(prev => prev === status ? 'ALL' : status)} style={{
              padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: `1px solid ${filter === status ? c.border : 'var(--color-border)'}`,
              background: filter === status ? c.bg : 'var(--color-surface)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: c.text, fontFamily: 'var(--font-display)' }}>{count}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>{status}</div>
            </button>
          );
        })}
      </div>

      {loading ? <div className="loading"><div className="spinner" /> Loading beds...</div> : (
        Object.keys(byType).length === 0
          ? <div className="empty-state"><Bed size={36} style={{ opacity: 0.3, margin: '0 auto 12px' }} /><h3>No beds found</h3></div>
          : Object.entries(byType).map(([type, typeBeds]) => (
            <div key={type} className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>
                  {type} Ward
                  <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)' }}>
                    {typeBeds.filter(b => b.status === 'OCCUPIED').length}/{typeBeds.length} occupied
                  </span>
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {typeBeds.map(bed => {
                  const c = BED_COLORS[bed.status];
                  return (
                    <div key={bed.id} style={{
                      padding: '14px 10px', borderRadius: 'var(--radius-md)', border: `1px solid ${c.border}`,
                      background: c.bg, textAlign: 'center', position: 'relative',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: c.text }}>{bed.bedNumber}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>{bed.wardName || type}</div>
                      <select
                        value={bed.status}
                        onChange={e => updateStatus(bed.id, e.target.value)}
                        style={{
                          marginTop: 8, width: '100%', padding: '3px 4px', fontSize: 11,
                          background: 'var(--color-surface)', color: 'var(--color-text)',
                          border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer',
                        }}
                      >
                        {['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
      )}
    </div>
  );
}
