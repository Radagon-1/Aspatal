import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Search, AlertCircle } from 'lucide-react';
import api from '../lib/api';

export default function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const load = async (q = '', p = 1) => {
    setLoading(true);
    try {
      const endpoint = q ? `/patients/search?q=${encodeURIComponent(q)}&page=${p}&limit=20`
                           : `/patients?page=${p}&limit=20`;
      const { data } = await api.get(endpoint);
      if (q) { setPatients(data); setPagination({}); }
      else { setPatients(data.data); setPagination(data.pagination); }
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(search, page); }, [page]);

  const handleSearch = (e) => {
    const v = e.target.value;
    setSearch(v);
    setPage(1);
    if (v.length === 0 || v.length >= 2) load(v, 1);
  };

  const genderBadge = (g) => ({ MALE: 'badge-accent', FEMALE: 'badge-primary', OTHER: 'badge-neutral' }[g] || 'badge-neutral');

  return (
    <div className="page fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Patients</h1>
          <p>Manage patient registrations and longitudinal health records</p>
        </div>
        <Link to="/patients/new" className="btn btn-primary"><Plus size={16} /> New Patient</Link>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Search by name, phone, or email…" value={search} onChange={handleSearch} />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading"><div className="spinner" /> Loading patients...</div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <h3>No patients found</h3>
            <p style={{ fontSize: 13 }}>Try a different search, or register a new patient</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Age / Gender</th>
                  <th>Contact</th>
                  <th>Risk</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{p.id.slice(0, 8)}…</div>
                    </td>
                    <td>
                      <span>{p.age} yrs</span>{' '}
                      <span className={`badge ${genderBadge(p.gender)}`} style={{ marginLeft: 6 }}>{p.gender}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{p.phone || p.email || '—'}</div>
                    </td>
                    <td>
                      {p.isHighRisk
                        ? <span className="badge badge-danger"><AlertCircle size={10} /> High Risk</span>
                        : <span className="badge badge-neutral">Normal</span>}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/patients/${p.id}`)}>View Records</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} total</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={!pagination.hasPrev}>← Prev</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={!pagination.hasNext}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
