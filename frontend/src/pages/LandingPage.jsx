import { Link } from 'react-router-dom';
import { Heart, Activity, Users, Bed, GitBranch, UserCheck, Shield, Wifi } from 'lucide-react';

const features = [
  { icon: Users, label: 'Patient Records', desc: 'Longitudinal health records across visits and facilities', color: 'var(--color-accent)' },
  { icon: Activity, label: 'AI Triage', desc: 'Clinical rule-based triage to prioritise care urgency', color: 'var(--color-primary)' },
  { icon: Bed, label: 'Bed Management', desc: 'Real-time ICU, general, emergency ward occupancy', color: 'var(--color-warning)' },
  { icon: GitBranch, label: 'Referral Tracking', desc: 'End-to-end referral state from PHC to district hospital', color: 'var(--color-danger)' },
  { icon: UserCheck, label: 'ASHA Portal', desc: 'Offline-first field worker app with background sync', color: 'var(--color-success)' },
  { icon: Shield, label: 'Secure & Scalable', desc: 'Role-based access for admin, doctors, and patients', color: 'var(--color-primary)' },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Nav */}
      <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Heart size={24} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--color-primary)' }}>Aspatal</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/login" className="btn btn-secondary btn-sm">Sign In</Link>
          <Link to="/login" className="btn btn-primary btn-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', padding: '100px 24px 60px' }}>
        <div className="badge badge-primary" style={{ marginBottom: 20, fontSize: 13 }}>
          <Wifi size={12} /> SIH 2025 — Problem Statement 26133
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px,6vw,68px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>
          Quality Healthcare for{' '}
          <span style={{ color: 'var(--color-primary)' }}>Every Village</span>
        </h1>
        <p style={{ fontSize: 18, color: 'var(--color-text-muted)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.8 }}>
          An integrated care-access platform for rural Maharashtra — bridging sub-centres,
          PHCs, rural hospitals and district hospitals with digital continuity.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" className="btn btn-primary btn-lg">
            <Heart size={18} /> Open Platform
          </Link>
          <a href="#features" className="btn btn-secondary btn-lg">Learn More</a>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: '40px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, textAlign: 'center' }}>
          {[['1.4B+', 'Indians Served'], ['~6lakh', 'Villages in India'], ['4 Tiers', 'of Care Supported'], ['Offline', 'First Design']].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: 'var(--color-primary)' }}>{v}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>Everything you need</h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: 48 }}>Designed for frontline health workers, doctors, and hospital administrators</p>
        <div className="grid-3" style={{ gap: 20 }}>
          {features.map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="card" style={{ transition: 'all 0.2s' }}>
              <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon size={20} style={{ color }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{label}</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '60px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, marginBottom: 12 }}>Ready to transform rural healthcare?</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 28 }}>Government of Maharashtra · Smart India Hackathon 2025</p>
        <Link to="/login" className="btn btn-primary btn-lg">Access Platform →</Link>
      </div>
    </div>
  );
}
