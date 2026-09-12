import { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';
import api from '../lib/api';

const SYMPTOMS = ['Fever', 'Cough', 'Chest Pain', 'Difficulty Breathing', 'Headache', 'Abdominal Pain', 'Vomiting', 'Diarrhoea', 'Weakness', 'Body Ache', 'Unconscious', 'Seizure', 'Stroke Signs', 'Severe Bleeding', 'High Fever'];

const URGENCY_CONFIG = {
  EMERGENCY: { icon: AlertTriangle, color: 'var(--color-danger)', label: 'EMERGENCY', desc: 'Immediate attention required — go to Emergency now' },
  URGENT: { icon: Clock, color: 'var(--color-warning)', label: 'URGENT', desc: 'Seek medical care within 1–2 hours' },
  STANDARD: { icon: Info, color: 'var(--color-accent)', label: 'STANDARD', desc: 'Schedule a consultation within 24–48 hours' },
  NON_URGENT: { icon: CheckCircle, color: 'var(--color-success)', label: 'NON-URGENT', desc: 'Home care — monitor and follow up if needed' },
};

export default function TriagePage() {
  const [form, setForm] = useState({
    age: '', sex: 'male', pregnancyStatus: false,
    existingConditions: [], symptoms: [],
    vitals: { systolic: '', diastolic: '', temperature: '', heartRate: '', oxygenSaturation: '' },
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState('');

  const toggleSymptom = (s) => setForm(f => ({
    ...f, symptoms: f.symptoms.includes(s) ? f.symptoms.filter(x => x !== s) : [...f.symptoms, s],
  }));
  const addCustom = () => { if (custom.trim()) { toggleSymptom(custom.trim()); setCustom(''); } };
  const setVital = (k) => (e) => setForm(f => ({ ...f, vitals: { ...f.vitals, [k]: e.target.value } }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setResult(null);
    try {
      const payload = {
        age: parseInt(form.age),
        sex: form.sex,
        pregnancy_status: form.pregnancyStatus,
        existing_conditions: form.existingConditions,
        symptoms: form.symptoms,
        vitals: {
          systolic: form.vitals.systolic ? parseInt(form.vitals.systolic) : null,
          diastolic: form.vitals.diastolic ? parseInt(form.vitals.diastolic) : null,
          temperature: form.vitals.temperature ? parseFloat(form.vitals.temperature) : null,
          heart_rate: form.vitals.heartRate ? parseInt(form.vitals.heartRate) : null,
          oxygen_saturation: form.vitals.oxygenSaturation ? parseFloat(form.vitals.oxygenSaturation) : null,
        },
      };
      const { data } = await api.post('/triage', payload);
      setResult(data);
    } catch { alert('Triage failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const cfg = result ? URGENCY_CONFIG[result.urgency] : null;

  return (
    <div className="page fade-in" style={{ maxWidth: 820 }}>
      <div className="page-header">
        <h1>Clinical Triage</h1>
        <p>AI-assisted urgency assessment — powered by the Python rules engine</p>
      </div>

      {result && cfg && (
        <div style={{ padding: 24, borderRadius: 'var(--radius-lg)', border: `2px solid ${cfg.color}`, background: `${cfg.color}14`, marginBottom: 24, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <cfg.icon size={28} style={{ color: cfg.color }} />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: cfg.color }}>{cfg.label}</div>
              <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{cfg.desc}</div>
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12, fontSize: 14 }}>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Suggested Facility:</span> <strong>{result.suggested_facility?.replace('_', ' ')}</strong></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Specialist:</span> <strong>{result.recommended_specialist || '—'}</strong></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Confidence:</span> <strong>{((result.confidence || 0) * 100).toFixed(0)}%</strong></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Source:</span> <strong>{result.source}</strong></div>
          </div>
          {result.red_flags?.length > 0 && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--color-danger-dim)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-danger)' }}>
              ⚠️ Red flags: {result.red_flags.join(' · ')}
            </div>
          )}
          {result.recommendations?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-muted)' }}>RECOMMENDATIONS</div>
              <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.recommendations.map((r, i) => <li key={i} style={{ fontSize: 14 }}>{r}</li>)}
              </ul>
            </div>
          )}
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={() => setResult(null)}>Run Again</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Patient Info</h3>
          <div className="grid-2" style={{ gap: 16 }}>
            <div className="form-group">
              <label className="label">Age *</label>
              <input className="input" type="number" min={0} max={120} placeholder="35" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="label">Sex *</label>
              <select className="input" value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="preg2" checked={form.pregnancyStatus} onChange={e => setForm(f => ({ ...f, pregnancyStatus: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
              <label htmlFor="preg2" className="label" style={{ margin: 0 }}>Currently pregnant</label>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Symptoms *</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {SYMPTOMS.map(s => (
              <button key={s} type="button" onClick={() => toggleSymptom(s)} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid', fontSize: 13,
                borderColor: form.symptoms.includes(s) ? 'var(--color-primary)' : 'var(--color-border)',
                background: form.symptoms.includes(s) ? 'var(--color-primary-dim)' : 'transparent',
                color: form.symptoms.includes(s) ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}>{s}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Add custom symptom…" value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={addCustom}>Add</button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Vitals (optional but improves accuracy)</h3>
          <div className="grid-3" style={{ gap: 16 }}>
            {[
              ['systolic', 'BP Systolic (mmHg)', '120'],
              ['diastolic', 'BP Diastolic (mmHg)', '80'],
              ['temperature', 'Temperature (°C)', '37.0'],
              ['heartRate', 'Heart Rate (bpm)', '72'],
              ['oxygenSaturation', 'SpO2 (%)', '98'],
            ].map(([k, lbl, ph]) => (
              <div key={k} className="form-group">
                <label className="label">{lbl}</label>
                <input className="input" type="number" step="0.1" placeholder={ph} value={form.vitals[k]} onChange={setVital(k)} />
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !form.symptoms.length}>
          {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Analysing...</> : <><Activity size={18} /> Run Triage Assessment</>}
        </button>
      </form>
    </div>
  );
}
