import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Activity, Bed, GitBranch, Calendar, Pill, Stethoscope } from 'lucide-react';
import api from '../lib/api';

const TABS = ['Overview', 'Visits', 'Admissions', 'Referrals', 'Follow-ups', 'Triage'];

function Section({ title, children, icon: Icon }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={16} style={{ color: 'var(--color-primary)' }} />} {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 14 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value || '—'}</span>
    </div>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/patients/${id}/history`)
      .then(({ data }) => setPatient(data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading"><div className="spinner" /> Loading patient...</div>;
  if (!patient) return <div className="page"><p>Patient not found</p></div>;

  const urgencyColor = { EMERGENCY: 'var(--color-danger)', URGENT: 'var(--color-warning)', STANDARD: 'var(--color-accent)', NON_URGENT: 'var(--color-success)' };

  return (
    <div className="page fade-in">
      <Link to="/patients" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}><ArrowLeft size={14} /> Back to patients</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={24} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{patient.name}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <span className="badge badge-neutral">{patient.age} yrs · {patient.gender}</span>
              {patient.isHighRisk && <span className="badge badge-danger">High Risk</span>}
              {patient.pregnancyStatus && <span className="badge badge-primary">Pregnant</span>}
            </div>
          </div>
        </div>
        <Link to={`/visits/new?patientId=${patient.id}`} className="btn btn-primary"><Stethoscope size={16} /> New Visit</Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', background: 'none', border: 'none', fontSize: 14, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid-2">
          <Section title="Personal Information" icon={User}>
            <InfoRow label="Phone" value={patient.phone} />
            <InfoRow label="Email" value={patient.email} />
            <InfoRow label="Blood Group" value={patient.bloodGroup} />
            <InfoRow label="Address" value={patient.address} />
            <InfoRow label="Emergency Contact" value={patient.emergencyContact} />
            <InfoRow label="Emergency Phone" value={patient.emergencyPhone} />
          </Section>
          <Section title="Medical Background" icon={Activity}>
            <InfoRow label="Existing Conditions" value={patient.existingConditions?.join(', ')} />
            <InfoRow label="Current Medications" value={patient.currentMedications?.join(', ')} />
            <InfoRow label="Known Allergies" value={patient.knownAllergies?.join(', ')} />
            <InfoRow label="Pregnancy Status" value={patient.pregnancyStatus ? 'Yes' : 'No'} />
          </Section>
        </div>
      )}

      {tab === 'Visits' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {patient.visits?.length === 0 && <div className="empty-state"><Stethoscope size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} /><h3>No visits recorded</h3></div>}
          {patient.visits?.map(v => (
            <div key={v.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{v.doctor?.name}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 13, marginLeft: 8 }}>{v.doctor?.specialization}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{new Date(v.visitDate).toLocaleDateString('en-IN')}</span>
              </div>
              <InfoRow label="Diagnosis" value={v.diagnosis} />
              <InfoRow label="Symptoms" value={v.symptoms?.join(', ')} />
              <InfoRow label="Prescriptions" value={v.prescriptions?.join(', ')} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {v.needsReferral && <span className="badge badge-warning">Referred</span>}
                {v.toBeAdmitted && <span className="badge badge-danger">Admitted</span>}
                {v.needsFollowUp && <span className="badge badge-accent">Follow-up</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Admissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {patient.admissions?.length === 0 && <div className="empty-state"><Bed size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} /><h3>No admissions</h3></div>}
          {patient.admissions?.map(a => (
            <div key={a.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div><span style={{ fontWeight: 600 }}>{a.hospital?.name}</span> · {a.bedType} bed</div>
                <span className={`badge ${a.status === 'ADMITTED' ? 'badge-danger' : 'badge-success'}`}>{a.status}</span>
              </div>
              <InfoRow label="Ward" value={a.wardName} />
              <InfoRow label="Room" value={a.roomNumber} />
              <InfoRow label="Admitted" value={new Date(a.admittedAt).toLocaleString('en-IN')} />
              {a.dischargedAt && <InfoRow label="Discharged" value={new Date(a.dischargedAt).toLocaleString('en-IN')} />}
            </div>
          ))}
        </div>
      )}

      {tab === 'Referrals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {patient.referrals?.length === 0 && <div className="empty-state"><GitBranch size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} /><h3>No referrals</h3></div>}
          {patient.referrals?.map(r => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{r.fromHospital?.name} → {r.toHospital?.name}</span>
                <span className={`badge status-${r.status}`} style={{ background: 'transparent', border: '1px solid currentColor', borderRadius: 'var(--radius-full)', padding: '2px 10px', fontSize: 12 }}>{r.status}</span>
              </div>
              <InfoRow label="Referred by" value={r.referredBy?.name} />
              <InfoRow label="Reason" value={r.reason} />
              <InfoRow label="Date" value={new Date(r.referredAt).toLocaleDateString('en-IN')} />
            </div>
          ))}
        </div>
      )}

      {tab === 'Follow-ups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {patient.followUps?.length === 0 && <div className="empty-state"><Calendar size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} /><h3>No upcoming follow-ups</h3></div>}
          {patient.followUps?.map(f => (
            <div key={f.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{new Date(f.scheduledDate).toLocaleDateString('en-IN')}</span>
                <span className={`badge ${f.isCompleted ? 'badge-success' : 'badge-warning'}`}>{f.isCompleted ? 'Done' : 'Pending'}</span>
              </div>
              <InfoRow label="Reason" value={f.reason} />
            </div>
          ))}
        </div>
      )}

      {tab === 'Triage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {patient.triageRecords?.length === 0 && <div className="empty-state"><Activity size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} /><h3>No triage records</h3></div>}
          {patient.triageRecords?.map(t => (
            <div key={t.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: urgencyColor[t.urgency] || 'inherit' }}>{t.urgency}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(t.triageDate).toLocaleString('en-IN')}</span>
              </div>
              <InfoRow label="Symptoms" value={t.symptoms?.join(', ')} />
              <InfoRow label="Suggested facility" value={t.suggestedFacility} />
              <InfoRow label="Recommended specialist" value={t.recommendedSpecialist} />
              {t.redFlags?.length > 0 && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--color-danger-dim)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-danger)' }}>
                  ⚠️ {t.redFlags.join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
