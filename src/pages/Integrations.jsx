import { useState, useEffect, useCallback } from 'react';
import { TopBar, PropertyChip } from '../components/TopBar.jsx';
import { Row, Toast } from '../components/ui.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fetchMyHotelWebhook, testMyWebhook } from '../store/webhookStore.js';

const fmtTime = (x) =>
  x ? new Date(x).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Integrations() {
  const { agent: me } = useAuth();
  const [hook, setHook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); clearTimeout(window.__it); window.__it = setTimeout(() => setToast(''), 3000); };

  const load = useCallback(() => {
    setLoading(true);
    fetchMyHotelWebhook().then(setHook).catch(() => setHook(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const runTest = async () => {
    setTesting(true);
    const res = await testMyWebhook();
    setTesting(false);
    if (res.ok) {
      const r = res.results[0];
      flash(r ? (r.ok ? 'Test delivered · HTTP ' + (r.response_code ?? '—') : 'Test failed · HTTP ' + (r.response_code ?? '—')) : 'Test sent');
    } else {
      flash('Test failed: ' + res.error);
    }
    load();
  };

  return (
    <div>
      <TopBar title="Integrations" kicker="Webhook · self-service" right={<PropertyChip>{me?.name || 'Front desk'}</PropertyChip>} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '26px 24px 80px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>Integrations</div>
        <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2, marginBottom: 18 }}>Your hotel's webhook delivers each captured sale to your systems in real time.</div>

        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--faint)', padding: '24px 0' }}>Loading…</div>
        ) : !hook ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '22px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No webhook configured</div>
            <div style={{ fontSize: 12.5, color: 'var(--gray)', marginTop: 4 }}>
              Your hotel doesn't have a webhook endpoint yet. To set one up, contact{' '}
              <a href="mailto:support@upsellcapture.com" style={{ color: 'var(--teal)' }}>support@upsellcapture.com</a>.
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--card)', border: '1px solid var(--teal-line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', background: 'var(--teal-bg)', borderBottom: '1px solid var(--teal-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{hook.name}</div>
              {hook.active
                ? <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--teal)', background: '#fff', padding: '2px 9px', borderRadius: 10 }}>Active</span>
                : <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--gray)', background: '#fff', padding: '2px 9px', borderRadius: 10 }}>Inactive</span>}
            </div>
            <div style={{ padding: '14px 16px' }}>
              <Row k="Endpoint URL" v={<span className="mono" style={{ fontSize: 12 }}>{hook.url}</span>} />
              <Row k="Secret" v={<span className="mono">•••••••• {hook.secret_last8}</span>} />
              <Row k="Status" v={hook.active ? 'Active' : 'Inactive'} />
              <Row k="Last fired" v={fmtTime(hook.last_fired)} />
              <Row k="Last status" v={hook.last_status ? (hook.last_status === 'success' ? 'Success' : 'Failed') : '—'} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                <button onClick={runTest} disabled={testing} style={{ padding: '10px 16px', background: testing ? 'var(--line2)' : 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 600, cursor: testing ? 'default' : 'pointer' }}>
                  {testing ? 'Sending…' : 'Test webhook'}
                </button>
                <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Sends a dummy <span className="mono">capture.created</span> payload to your endpoint.</span>
              </div>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', background: 'var(--blue-bg)', fontSize: 12, color: 'var(--gray)' }}>
              You can view and test your webhook here. To update the URL or secret, contact{' '}
              <a href="mailto:support@upsellcapture.com" style={{ color: 'var(--blue)' }}>support@upsellcapture.com</a>.
            </div>
          </div>
        )}
      </div>

      <Toast>{toast}</Toast>
    </div>
  );
}
