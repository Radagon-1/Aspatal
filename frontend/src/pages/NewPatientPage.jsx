import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import api from '../lib/api';

const CONDITIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'Kidney Disease', 'Tuberculosis', 'Anaemia'];
const ALLERGIES = ['Penicillin', 'Sulfa', 'Aspirin', 'Ibuprofen', 'Latex'];

function TagInput({ label, options, selected, onChange }) {
  const [custom, setCustom] = useState('');
  const toggle = (item) => onChange(selected.includes(item) ? selected.filter(x => x !== item) : [...selected, item]);
  const addCustom = () => { if (custom.trim() && !selected.includes(custom.trim())) { onChange([...selected, custom.trim()]); setCustom(''); } };

  return (
    <div className="form-group">
      <label className="label">{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {options.map(o => (
          <button key={o} type="button" onClick={() => toggle(o)} style={{
            padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: 13, border: '1px solid',
            borderColor: selected.includes(o) ? 'var(--color-primary)' : 'var(--color-border)',
            background: selected.includes(o) ? 'var(--color-primary-dim)' : 'transparent',
            color: selected.includes(o) ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}>{o}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" style={{ flex: 1 }} placeholder="Add custom…" value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={addCustom}>Add</button>
      </div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {selected.map(s => (
            <span key={s} className="badge badge-primary" style={{ cursor: 'pointer' }} onClick={() => toggle(s)}>{s} ×</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewPatientPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', age: '', gender: 'MALE', phone: '', email: '', bloodGroup: '',
    address: '', emergencyContact: '', emergencyPhone: '',
    existingConditions: [], currentMedications: [], knownAllergies: [],
    pregnancyStatus: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setArr = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = { ...form, age: parseInt(form.age) };
      const { data } = await api.post('/patients', payload);
      navigate(`/patients/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register patient');
    } finally { setLoading(false); }
  };

  return (
    <div className="page fade-in" style={{ maxWidth: 760 }}>
      <Link to="/patients" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}><ArrowLeft size={14} /> Back</Link>

      <div className="page-header">
        <h1><UserPlus size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />Register Patient</h1>
        <p>Fill in patient details for their health record</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Personal Information</h3>
          <div className="grid-2" style={{ gap: 16 }}>
            <div className="form-group">
              <label className="label">Full Name *</label>
              <input className="input" placeholder="Ramesh Kumar" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label className="label">Age *</label>
              <input className="input" type="number" min={0} max={120} placeholder="34" value={form.age} onChange={set('age')} required />
            </div>
            <div className="form-group">
              <label className="label">Gender *</label>
              <select className="input" value={form.gender} onChange={set('gender')}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Blood Group</label>
              <select className="input" value={form.bloodGroup} onChange={set('bloodGroup')}>
                <option value="">Unknown</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Phone Number</label>
              <input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="patient@email.com" value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Address</label>
              <input className="input" placeholder="Village, Taluka, District" value={form.address} onChange={set('address')} />
            </div>
            <div className="form-group">
              <label className="label">Emergency Contact Name</label>
              <input className="input" placeholder="Sunita Kumar" value={form.emergencyContact} onChange={set('emergencyContact')} />
            </div>
            <div className="form-group">
              <label className="label">Emergency Phone</label>
              <input className="input" type="tel" placeholder="+91 99999 88888" value={form.emergencyPhone} onChange={set('emergencyPhone')} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="preg" checked={form.pregnancyStatus} onChange={e => setForm(f => ({ ...f, pregnancyStatus: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
              <label htmlFor="preg" className="label" style={{ margin: 0 }}>Currently pregnant</label>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Medical Background</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <TagInput label="Existing Conditions" options={CONDITIONS} selected={form.existingConditions} onChange={setArr('existingConditions')} />
            <TagInput label="Known Allergies" options={ALLERGIES} selected={form.knownAllergies} onChange={setArr('knownAllergies')} />
            <TagInput label="Current Medications" options={[]} selected={form.currentMedications} onChange={setArr('currentMedications')} />
          </div>
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-dim)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-danger)', marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Registering...</> : 'Register Patient'}
          </button>
          <Link to="/patients" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
