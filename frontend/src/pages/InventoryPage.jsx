import { useEffect, useState } from 'react';
import { Package, Pill, Settings, FlaskConical, AlertTriangle, Plus } from 'lucide-react';
import api from '../lib/api';

const TABS = ['Medicines', 'Machines', 'Pharmacy'];
const hospitalId = 'seed-hospital-1'; // In production: from user context

export default function InventoryPage() {
  const [tab, setTab] = useState('Medicines');
  const [medicines, setMedicines] = useState([]);
  const [machines, setMachines] = useState([]);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [med, mach, ph] = await Promise.all([
          api.get(`/inventory/medicines/hospital/${hospitalId}`),
          api.get(`/inventory/machines/hospital/${hospitalId}`),
          api.get(`/inventory/pharmacy/hospital/${hospitalId}`),
        ]);
        setMedicines(med.data);
        setMachines(mach.data);
        setPharmacy(ph.data);
      } catch { } finally { setLoading(false); }
    };
    load();
  }, []);

  const lowStock = medicines.filter(m => m.quantity <= m.reorderLevel);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1>Inventory</h1>
        <p>Medicines, diagnostic machines, and pharmacy management</p>
      </div>

      {lowStock.length > 0 && (
        <div style={{ padding: '12px 16px', background: 'var(--color-warning-dim)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
          <strong>{lowStock.length} medicine(s)</strong> below reorder level: {lowStock.map(m => m.name).join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}>{t}</button>
        ))}
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <>
          {tab === 'Medicines' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>Medicine Stock ({medicines.length})</h3>
              </div>
              {medicines.length === 0 ? (
                <div className="empty-state"><Pill size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} /><p style={{ fontSize: 13 }}>No medicines added</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Medicine</th><th>Category</th><th>Stock</th><th>Reorder Level</th><th>Status</th></tr></thead>
                    <tbody>
                      {medicines.map(m => {
                        const isLow = m.quantity <= m.reorderLevel;
                        return (
                          <tr key={m.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{m.name}</div>
                              {m.genericName && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{m.genericName}</div>}
                            </td>
                            <td style={{ fontSize: 13 }}>{m.category || '—'}</td>
                            <td>
                              <span style={{ fontWeight: 700, color: isLow ? 'var(--color-danger)' : 'var(--color-text)' }}>
                                {m.quantity}
                              </span>
                              {m.unit && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 4 }}>{m.unit}</span>}
                            </td>
                            <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{m.reorderLevel}</td>
                            <td>
                              {isLow
                                ? <span className="badge badge-danger"><AlertTriangle size={10} /> Low Stock</span>
                                : <span className="badge badge-success">OK</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'Machines' && (
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Diagnostic Machines ({machines.length})</h3>
              {machines.length === 0 ? (
                <div className="empty-state"><FlaskConical size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} /><p style={{ fontSize: 13 }}>No machines added</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {machines.map(m => (
                    <div key={m.id} style={{ padding: 16, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>Type: {m.type || '—'}</div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {m.testsPerformable?.map(t => <span key={t} className="badge badge-neutral" style={{ fontSize: 11 }}>{t}</span>)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`badge ${m.isOperational ? 'badge-success' : 'badge-danger'}`}>{m.isOperational ? 'Operational' : 'Down'}</span>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>{m.operatorsAvailable} operators</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'Pharmacy' && (
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Pharmacy Information</h3>
              {!pharmacy ? (
                <div className="empty-state"><Settings size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} /><p style={{ fontSize: 13 }}>No pharmacy data yet</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['Dispensaries', pharmacy.dispensariesCount],
                    ['Pharmacists Available', pharmacy.pharmacistsAvailable],
                    ['Status', pharmacy.isOpen ? '🟢 Open' : '🔴 Closed'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)', fontSize: 14 }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
