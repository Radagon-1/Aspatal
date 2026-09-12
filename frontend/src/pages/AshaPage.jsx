import { useEffect, useState } from 'react';
import { UserCheck, Wifi, WifiOff, Plus, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

// IndexedDB helper for offline visit storage
const STORE = 'asha_visits';
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aspatal_offline', 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
}
async function saveOfflineVisit(visit) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(visit);
    tx.oncomplete = res;
    tx.onerror = rej;
  });
}
async function getOfflineVisits() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
}
async function clearOfflineVisits() {
  const db = await openDB();
  return new Promise((res) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = res;
  });
}

export default function AshaPage() {
  const { user } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [visits, setVisits] = useState([]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ visitType: 'household_visit', householdId: '', notes: '', vitalsRecorded: {} });
  const workerId = 'seed-asha-1'; // In production: user.ashaWorker.id

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    loadVisits();
    checkOffline();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const loadVisits = async () => {
    try {
      const { data } = await api.get(`/asha/${workerId}/visits`);
      setVisits(data);
    } catch { }
  };

  const checkOffline = async () => {
    const offline = await getOfflineVisits();
    setOfflineCount(offline.length);
  };

  const submitVisit = async (e) => {
    e.preventDefault();
    const visit = { ...form, ashaWorkerId: workerId, id: `offline_${Date.now()}`, visitDate: new Date().toISOString(), isSynced: false };

    if (online) {
      try {
        await api.post('/asha/visits', { ...form, ashaWorkerId: workerId });
        await loadVisits();
      } catch { await saveOfflineVisit(visit); await checkOffline(); }
    } else {
      await saveOfflineVisit(visit);
      await checkOffline();
      alert('Saved offline — will sync when you reconnect');
    }
    setShowForm(false);
    setForm({ visitType: 'household_visit', householdId: '', notes: '', vitalsRecorded: {} });
  };

  const sync = async () => {
    if (!online) return alert('No internet connection');
    setSyncing(true);
    try {
      const offline = await getOfflineVisits();
      if (!offline.length) { setSyncing(false); return alert('No offline records to sync'); }
      const { data } = await api.post('/asha/visits/sync', { visits: offline });
      await clearOfflineVisits();
      await checkOffline();
      await loadVisits();
      alert(`✅ Synced ${data.synced} records`);
    } catch { alert('Sync failed — try again'); }
    finally { setSyncing(false); }
  };

  return (
    <div className="page fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>ASHA Worker Portal</h1>
          <p>Household visits, patient registration, and offline-first data sync</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-full)', background: online ? 'var(--color-success-dim)' : 'var(--color-danger-dim)', color: online ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 13, fontWeight: 600 }}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />} {online ? 'Online' : 'Offline'}
          </div>
          {offlineCount > 0 && (
            <button className="btn btn-primary btn-sm" onClick={sync} disabled={syncing}>
              {syncing ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Syncing...</> : <><RefreshCw size={14} /> Sync ({offlineCount})</>}
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}><Plus size={14} /> Log Visit</button>
        </div>
      </div>

      {!online && (
        <div style={{ padding: '12px 16px', background: 'var(--color-warning-dim)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
          <WifiOff size={16} style={{ color: 'var(--color-warning)' }} />
          You are offline. Visits will be saved locally and synced when you reconnect.
        </div>
      )}

      {offlineCount > 0 && (
        <div style={{ padding: '12px 16px', background: 'var(--color-accent-dim)', border: '1px solid rgba(79,142,247,0.3)', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 20 }}>
          📦 {offlineCount} visit(s) stored offline and waiting to sync.
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Log Household Visit</h3>
          <form onSubmit={submitVisit}>
            <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="label">Visit Type</label>
                <select className="input" value={form.visitType} onChange={e => setForm(f => ({ ...f, visitType: e.target.value }))}>
                  <option value="household_visit">Household Visit</option>
                  <option value="patient_registration">Patient Registration</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="antenatal_care">Antenatal Care</option>
                  <option value="immunization">Immunization</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Household ID / Address</label>
                <input className="input" placeholder="HH-001 or address" value={form.householdId} onChange={e => setForm(f => ({ ...f, householdId: e.target.value }))} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="label">Notes / Observations</label>
              <textarea className="input" rows={3} placeholder="Patient complained of fever…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary">Save {!online ? '(Offline)' : ''}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Visits</h3>
        {visits.length === 0 ? (
          <div className="empty-state" style={{ padding: 30 }}>
            <UserCheck size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13 }}>No visits recorded yet</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Household</th><th>Notes</th><th>Sync</th></tr></thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontSize: 13 }}>{new Date(v.visitDate).toLocaleDateString('en-IN')}</td>
                    <td><span className="badge badge-accent">{v.visitType.replace(/_/g, ' ')}</span></td>
                    <td style={{ fontSize: 13 }}>{v.householdId || '—'}</td>
                    <td style={{ fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes || '—'}</td>
                    <td><span className={`badge ${v.isSynced ? 'badge-success' : 'badge-warning'}`}>{v.isSynced ? '✓ Synced' : 'Pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
