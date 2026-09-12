import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Heart, Mail, Lock, Phone, Shield } from 'lucide-react';

const TABS = ['Email', 'Phone', 'Admin'];

export default function LoginPage() {
  const { login, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Email');
  const [form, setForm] = useState({ email: '', phone: '', password: '', otp: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (tab === 'Admin') {
        await adminLogin({ email: form.email, password: form.password });
      } else if (tab === 'Email') {
        await login({ email: form.email, password: form.password });
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Heart size={28} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--color-primary)' }}>Aspatal</span>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Rural Healthcare Access Platform</p>
        </div>

        <div className="card">
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 3, marginBottom: 24, gap: 2 }}>
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                style={{
                  flex: 1, padding: '8px', borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                  background: tab === t ? 'var(--color-surface)' : 'transparent',
                  color: tab === t ? 'var(--color-text)' : 'var(--color-text-muted)',
                  boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {t === 'Admin' ? <><Shield size={12} style={{ marginRight: 4 }} />Admin</> : t}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(tab === 'Email' || tab === 'Admin') && (
              <div className="form-group">
                <label className="label">Email address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input className="input" style={{ paddingLeft: 38 }} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
                </div>
              </div>
            )}

            {tab === 'Phone' && (
              <div className="form-group">
                <label className="label">Phone number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input className="input" style={{ paddingLeft: 38 }} type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} required />
                </div>
              </div>
            )}

            {(tab === 'Email' || tab === 'Admin') && (
              <div className="form-group">
                <label className="label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input className="input" style={{ paddingLeft: 38 }} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
                </div>
              </div>
            )}

            {tab === 'Phone' && !otpSent && (
              <button type="button" className="btn btn-secondary" onClick={() => setOtpSent(true)}>Send OTP</button>
            )}
            {tab === 'Phone' && otpSent && (
              <div className="form-group">
                <label className="label">Enter OTP</label>
                <input className="input" type="text" placeholder="6-digit OTP" maxLength={6} value={form.otp} onChange={set('otp')} />
              </div>
            )}

            {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-dim)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--color-danger)' }}>{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Signing in...</> : tab === 'Admin' ? 'Admin Sign In' : 'Sign In'}
            </button>
          </form>

          {tab !== 'Admin' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', color: 'var(--color-text-faint)', fontSize: 12 }}>
                <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
                OR
                <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
              </div>
              <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/google`} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width={18} /> Continue with Google
              </a>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--color-text-muted)' }}>
          Don't have an account? <Link to="/login" style={{ color: 'var(--color-primary)' }}>Register as Patient</Link>
        </p>
      </div>
    </div>
  );
}
