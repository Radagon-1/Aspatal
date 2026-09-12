import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Stethoscope } from 'lucide-react';
import api from '../lib/api';

const SYMPTOMS = ['Fever', 'Cough', 'Headache', 'Chest Pain', 'Difficulty Breathing', 'Abdominal Pain', 'Vomiting', 'Diarrhoea', 'Weakness', 'Dizziness', 'Body Ache', 'Sore Throat'];

function SymptomPicker({ selected, onChange }) {
  const [custom, setCustom] = useState('');
  const toggle = (s) => onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]);
  const add = () => { if (custom.trim()) { onChange([...selected, custom.trim()]); setCustom(''); } };
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {SYMPTOMS.map(s => (
          <button key={s} type="button" onClick={() => toggle(s)} style={{
            padding: '5px 14px', borderRadius: 'var(--radius-full)', fontSize: 13, border: '1px solid',
            borderColor: selected.includes(s) ? 'var(--color-primary)' : 'var(--color-border)',
            background: selected.includes(s) ? 'var(--color-primary-dim)' : 'transparent',
            color: selected.includes(s) ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}>{s}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" placeholder="Add custom symptom…" value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}>Add</button>
      </div>
    </div>
  );
}

export default function NewVisitPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const prePatient = params.get('patientId') || '';

  const [form, setForm] = useState({
    patientId: prePatient, doctorId: '', hospitalId: '',
    symptoms: [], diagnosis: '', prescriptions: '', medicalTestsOrdered: '',
    bloodPressureSystolic: '', bloodPressureDiastolic: '', bodyTemperature: '',
    heartRate: '', oxygenSaturation: '', notes: '',
    toBeAdmitted: false, needsReferral: false, needsFollowUp: false,
  });
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/doctors').then(({ data }) => setDoctors(data.data || []));
    if (!prePatient) api.get('/patients?limit=50').then(({ data }) => setPatients(data.data || []));
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.checked }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = {
        ...form,
        prescriptions: form.prescriptions.split('\n').filter(Boolean),
        medicalTestsOrdered: form.medicalTestsOrdered.split(',').map(s => s.trim()).filter(Boolean),
        bloodPressureSystolic: form.bloodPressureSystolic ? parseInt(form.bloodPressureSystolic) : null,
        bloodPressureDiastolic: form.bloodPressureDiastolic ? parseInt(form.bloodPressureDiastolic) : null,
        bodyTemperature: form.bodyTemperature ? parseFloat(form.bodyTemperature) : null,
        heartRate: form.heartRate ? parseInt(form.heartRate) : null,
        oxygenSaturation: form.oxygenSaturation ? parseFloat(form.oxygenSaturation) : null,
      };
      await api.post('/visits', payload);
      navigate(prePatient ? `/patients/${prePatient}` : '/patients');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record visit');
    } finally { setLoading(false); }
  };

  return (
    <div className="page fade-in" style={{ maxWidth: 800 }}>
      <Link to="/patients" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}><ArrowLeft size={14} /> Back</Link>
      <div className="page-header">
        <h1><Stethoscope size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />Record Doctor Visit</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Visit Details</h3>
          <div className="grid-2" style={{ gap: 16 }}>
            {!prePatient && (
              <div className="form-group">
                <label className="label">Patient *</label>
                <select className="input" value={form.patientId} onChange={set('patientId')} required>
                  <option value="">Select patient…</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.age} yrs)</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="label">Doctor *</label>
              <select className="input" value={form.doctorId} onChange={(e) => {
                const doc = doctors.find(d => d.id === e.target.value);
                setForm(f => ({ ...f, doctorId: e.target.value, hospitalId: doc?.hospitalId || '' }));
              }} required>
                <option value="">Select doctor…</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Symptoms</h3>
          <SymptomPicker selected={form.symptoms} onChange={(v) => setForm(f => ({ ...f, symptoms: v }))} />
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Vitals</h3>
          <div className="grid-3" style={{ gap: 16 }}>
            <div className="form-group">
              <label className="label">BP Systolic (mmHg)</label>
              <input className="input" type="number" placeholder="120" value={form.bloodPressureSystolic} onChange={set('bloodPressureSystolic')} />
            </div>
            <div className="form-group">
              <label className="label">BP Diastolic (mmHg)</label>
              <input className="input" type="number" placeholder="80" value={form.bloodPressureDiastolic} onChange={set('bloodPressureDiastolic')} />
            </div>
            <div className="form-group">
              <label className="label">Temperature (°C)</label>
              <input className="input" type="number" step="0.1" placeholder="37.0" value={form.bodyTemperature} onChange={set('bodyTemperature')} />
            </div>
            <div className="form-group">
              <label className="label">Heart Rate (bpm)</label>
              <input className="input" type="number" placeholder="72" value={form.heartRate} onChange={set('heartRate')} />
            </div>
            <div className="form-group">
              <label className="label">SpO2 (%)</label>
              <input className="input" type="number" step="0.1" min="0" max="100" placeholder="98" value={form.oxygenSaturation} onChange={set('oxygenSaturation')} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Diagnosis & Prescription</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="label">Diagnosis</label>
              <input className="input" placeholder="Clinical diagnosis…" value={form.diagnosis} onChange={set('diagnosis')} />
            </div>
            <div className="form-group">
              <label className="label">Prescriptions (one per line)</label>
              <textarea className="input" rows={4} placeholder={"Tab. Paracetamol 500mg x 3/day\nSyr. ORS 200ml x 2/day"} value={form.prescriptions} onChange={set('prescriptions')} />
            </div>
            <div className="form-group">
              <label className="label">Medical Tests Ordered (comma-separated)</label>
              <input className="input" placeholder="CBC, Blood Sugar, X-Ray Chest" value={form.medicalTestsOrdered} onChange={set('medicalTestsOrdered')} />
            </div>
            <div className="form-group">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} placeholder="Additional clinical notes…" value={form.notes} onChange={set('notes')} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Outcome</h3>
          <div style={{ display: 'flex', gap: 24 }}>
            {[['toBeAdmitted', 'Admit patient'], ['needsReferral', 'Requires referral'], ['needsFollowUp', 'Schedule follow-up']].map(([k, lbl]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={form[k]} onChange={setCheck(k)} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
                {lbl}
              </label>
            ))}
          </div>
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-dim)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-danger)', marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving...</> : 'Save Visit'}
          </button>
          <Link to="/patients" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
