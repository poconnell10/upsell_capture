import { useState, useEffect, useCallback } from 'react';
import { TopBar, PropertyChip } from '../../components/TopBar.jsx';
import { Toast } from '../../components/ui.jsx';
import { fetchHotelsWithCounts } from '../../store/adminStore.js';
import {
  fetchWebhookConfigs, createWebhookConfig, setWebhookActive, deleteWebhookConfig,
  fetchWebhookLogs, fetchLastFires, testWebhookConfig,
} from '../../store/webhookStore.js';

const fld = {
  fontSize: 13, padding: '8px 10px', border: '1px solid var(--line2)',
  borderRadius: 'var(--r-sm)', outline: 'none', background: '#fff', width: '100%',
};
const lab = {
  fontSize: 10.5, fontWeight: 600, color: 'var(--gray)', textTransform: 'uppercase',
  letterSpacing: '.04em', display: 'block', marginBottom: 4,
};
const fmtTime = (x) =>
  new Date(x).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const StatusPill = ({ status }) => {
  if (!status) return <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>—</span>;
  const ok = status === 'success';
  return (
    <span style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: ok ? 'var(--teal-bg)' : 'var(--crit-bg)', color: ok ? 'var(--teal)' : 'var(--crit)' }}>
      {ok ? 'Success' : 'Failed'}
    </span>
  );
};

export default function AdminWebhooks() {
  const [configs, setConfigs] = useState([]);
  const [fires, setFires] = useState({});
  const [logs, setLogs] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [hotelId, setHotelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); clearTimeout(window.__wt); window.__wt = setTimeout(() => setToast(''), 3000); };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchWebhookConfigs(), fetchLastFires(), fetchWebhookLogs(50), fetchHotelsWithCounts()])
      .then(([c, f, l, h]) => {
        setConfigs(c); setFires(f); setLogs(l); setHotels(h); setError('');
        if (!hotelId && h.length) setHotelId(h[0].id);
      })
      .catch((e) => setError(e.message || 'Failed to load webhooks'))
      .finally(() => setLoading(false));
  }, [hotelId]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const globals = configs.filter((c) => c.hotel_id === null);
  const hotelConfig = configs.find((c) => c.hotel_id === hotelId) || null;

  const onTest = async (cfg) => {
    flash('Testing ' + cfg.name + '…');
    const res = await testWebhookConfig(cfg.id);
    if (res.ok) {
      const r = res.results[0];
      flash(r ? (r.ok ? 'Test delivered · HTTP ' + (r.response_code ?? '—') : 'Test failed · HTTP ' + (r.response_code ?? '—')) : 'Test sent');
    } else {
      flash('Test failed: ' + res.error);
    }
    load();
  };
  const onToggle = async (cfg) => {
    try { await setWebhookActive(cfg.id, !cfg.active); flash(cfg.active ? 'Webhook disabled' : 'Webhook enabled'); load(); }
    catch (e) { flash(e.message || 'Update failed'); }
  };
  const onDelete = async (cfg) => {
    if (!window.confirm('Delete webhook "' + cfg.name + '"? Its logs will be removed too.')) return;
    try { await deleteWebhookConfig(cfg.id); flash('Webhook deleted'); load(); }
    catch (e) { flash(e.message || 'Delete failed'); }
  };
  const onAdd = async ({ hotelId: hid, name, url, secret }) => {
    try { await createWebhookConfig({ hotelId: hid, name, url, secret }); flash('Webhook added'); load(); return true; }
    catch (e) { flash(e.message || 'Could not add webhook'); return false; }
  };

  return (
    <div>
      <TopBar title="Admin" kicker="Vendor console" right={<PropertyChip>All hotels</PropertyChip>} />

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 24px 80px' }}>
        <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 6 }}>Admin</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>Webhooks</div>
        <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2, marginBottom: 18 }}>Push captures to external endpoints in near real-time.</div>

        {error && <div style={{ fontSize: 12.5, color: '#991B1B', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16 }}>{error}</div>}

        {/* GLOBAL */}
        <SectionTitle title="Global webhooks · IN-Gauge" sub="Receive every capture across all hotels." />
        <WebhookTable rows={globals} fires={fires} loading={loading} emptyText="No global webhooks yet." onTest={onTest} onToggle={onToggle} onDelete={onDelete} />
        <AddForm onAdd={(v) => onAdd({ ...v, hotelId: null })} kind="global" />

        {/* HOTEL */}
        <div style={{ height: 26 }} />
        <SectionTitle title="Hotel webhooks" sub="Each hotel receives only its own captures · one webhook per hotel." />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={lab}>Hotel</span>
          <select value={hotelId} onChange={(e) => setHotelId(e.target.value)} style={{ ...fld, width: 280 }}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}{h.active ? '' : ' (inactive)'}</option>)}
          </select>
        </div>
        {hotelConfig ? (
          <WebhookTable rows={[hotelConfig]} fires={fires} loading={loading} onTest={onTest} onToggle={onToggle} onDelete={onDelete} />
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', padding: '4px 0 12px' }}>This hotel has no webhook yet — add one below.</div>
            <AddForm key={hotelId} onAdd={(v) => onAdd({ ...v, hotelId })} kind="hotel" disabled={!hotelId} />
          </>
        )}

        {/* LOGS */}
        <div style={{ height: 26 }} />
        <SectionTitle title="Webhook logs" sub="Last 50 delivery attempts." />
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          <table>
            <thead><tr style={{ background: 'var(--sunken)' }}>
              {['Time', 'Webhook', 'Confirmation', 'Status', 'Code', 'Attempts'].map((h, i) => (
                <th key={i} style={{ textAlign: i >= 4 ? 'right' : 'left', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', padding: '9px 14px' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--gray)' }}>{fmtTime(l.firedAt)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12.5, fontWeight: 500 }}>{l.webhookName}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }} className="mono"><span style={{ color: 'var(--teal)' }}>{l.confirmation}</span></td>
                  <td style={{ padding: '10px 14px' }}><StatusPill status={l.status} /></td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12.5, color: l.responseCode && l.responseCode < 400 ? 'var(--gray)' : 'var(--crit)' }} className="mono">{l.responseCode ?? '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--gray)' }} className="mono">{l.attempts}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 && <tr><td colSpan={6} style={{ padding: '24px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>No deliveries logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Toast>{toast}</Toast>
    </div>
  );
}

const SectionTitle = ({ title, sub }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 1 }}>{sub}</div>}
  </div>
);

function WebhookTable({ rows, fires, loading, emptyText, onTest, onToggle, onDelete }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 12 }}>
      <table>
        <thead><tr style={{ background: 'var(--sunken)' }}>
          {['Name', 'URL', 'Status', 'Last fired', 'Last status', ''].map((h, i) => (
            <th key={i} style={{ textAlign: 'left', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', padding: '9px 14px' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map((c) => {
            const f = fires[c.id];
            return (
              <tr key={c.id} style={{ borderTop: '1px solid var(--line)', opacity: c.active ? 1 : 0.65 }}>
                <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '11px 14px', fontSize: 11.5, color: 'var(--gray)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="mono">{c.url}</td>
                <td style={{ padding: '11px 14px' }}>
                  {c.active
                    ? <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-bg)', padding: '2px 8px', borderRadius: 10 }}>Active</span>
                    : <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--gray)', background: 'var(--sunken)', padding: '2px 8px', borderRadius: 10 }}>Inactive</span>}
                </td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--gray)' }}>{f ? fmtTime(f.firedAt) : '—'}</td>
                <td style={{ padding: '11px 14px' }}><StatusPill status={f?.status} /></td>
                <td style={{ padding: '11px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => onTest(c)} style={{ fontSize: 11.5, color: 'var(--teal)', background: 'none', border: 'none', marginRight: 12 }}>Test</button>
                  <button onClick={() => onToggle(c)} style={{ fontSize: 11.5, color: 'var(--gray)', background: 'none', border: 'none', marginRight: 12 }}>{c.active ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => onDelete(c)} style={{ fontSize: 11.5, color: '#DC2626', background: 'none', border: 'none' }}>Delete</button>
                </td>
              </tr>
            );
          })}
          {!loading && rows.length === 0 && emptyText && <tr><td colSpan={6} style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>{emptyText}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AddForm({ onAdd, kind, disabled }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && url.trim() && secret.trim() && !disabled;
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onAdd({ name, url, secret });
    setBusy(false);
    if (ok) { setName(''); setUrl(''); setSecret(''); }
  };
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Add {kind === 'global' ? 'global' : 'hotel'} webhook</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}><span style={lab}>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'global' ? 'IN-Gauge Global' : 'Hilton Orlando'} style={fld} /></div>
        <div style={{ flex: 1.6, minWidth: 220 }}><span style={lab}>Endpoint URL</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="mono" style={fld} /></div>
        <div style={{ flex: 1, minWidth: 160 }}><span style={lab}>Secret</span><input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="sk_…" className="mono" style={fld} /></div>
        <button onClick={submit} disabled={!valid || busy} style={{ padding: '9px 16px', background: valid && !busy ? 'var(--teal)' : 'var(--line2)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, cursor: valid && !busy ? 'pointer' : 'not-allowed' }}>{busy ? 'Adding…' : '+ Add'}</button>
      </div>
    </div>
  );
}
