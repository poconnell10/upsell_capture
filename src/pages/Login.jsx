import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured } from '../lib/supabase';

const inp = {
  fontSize: 14, padding: '10px 12px', border: '1px solid var(--line2)',
  borderRadius: 'var(--r-sm)', outline: 'none', width: '100%', background: '#fff',
};
const lbl = {
  fontSize: 11, fontWeight: 600, color: 'var(--gray)', letterSpacing: '.02em',
  display: 'block', marginBottom: 5,
};

export default function Login() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (session) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err.message || 'Sign-in failed.');
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ width: 380, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
          <span style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--teal)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700 }}>U</span>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Upsell Capture</span>
        </div>

        <form onSubmit={submit} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '24px 22px' }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Agent sign in</div>
          <div style={{ fontSize: 12.5, color: 'var(--gray)', marginTop: 3, marginBottom: 18 }}>Capture upsells against your hotel's bookings.</div>

          {!isSupabaseConfigured && (
            <div style={{ fontSize: 11.5, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 'var(--r-sm)', padding: '8px 10px', marginBottom: 14 }}>
              Supabase isn't configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in <span className="mono">.env</span>.
            </div>
          )}

          <label style={lbl}>Email</label>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hotel.com" style={inp} />

          <label style={{ ...lbl, marginTop: 14 }}>Password</label>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inp} />

          {error && <div style={{ fontSize: 12, color: '#991B1B', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--r-sm)', padding: '8px 10px', marginTop: 14 }}>{error}</div>}

          <button type="submit" disabled={busy} style={{ marginTop: 18, width: '100%', padding: '12px', background: busy ? 'var(--line2)' : 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', marginTop: 14 }}>
          Accounts are provisioned by your hotel administrator.
        </div>
      </div>
    </div>
  );
}
