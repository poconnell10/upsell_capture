import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TopBar, PropertyChip } from '../../components/TopBar.jsx';
import { Toast } from '../../components/ui.jsx';
import {
  fetchHotel, fetchHotelAgents, createAgent, setAgentActive, inviteAgent,
} from '../../store/adminStore.js';

const fld = {
  fontSize: 13, padding: '8px 10px', border: '1px solid var(--line2)',
  borderRadius: 'var(--r-sm)', outline: 'none', background: '#fff', width: '100%',
};
const lab = {
  fontSize: 10.5, fontWeight: 600, color: 'var(--gray)', textTransform: 'uppercase',
  letterSpacing: '.04em', display: 'block', marginBottom: 4,
};
const fmtDate = (x) => new Date(x).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export default function AdminAgents() {
  const { hotelId } = useParams();
  const [hotel, setHotel] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); clearTimeout(window.__aat); window.__aat = setTimeout(() => setToast(''), 2600); };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchHotel(hotelId), fetchHotelAgents(hotelId)])
      .then(([h, a]) => { setHotel(h); setAgents(a); setError(''); })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [hotelId]);
  useEffect(() => { load(); }, [load]);

  const valid = name.trim() && email.trim() && code.trim();

  const addAgent = async () => {
    if (!valid || adding) return;
    setAdding(true);
    try {
      await createAgent({ hotelId, name, email, agentCode: code });
      // Send the password-setup invite (server-side edge function).
      const redirectTo = window.location.origin + '/login';
      const res = await inviteAgent(email.trim(), redirectTo);
      setName(''); setEmail(''); setCode('');
      load();
      flash(res.ok ? 'Agent added · invite email sent' : 'Agent added · invite failed: ' + res.error);
    } catch (e) {
      flash(e.message || 'Could not add agent');
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (a) => {
    try {
      await setAgentActive(a.id, !a.active);
      flash(a.active ? 'Agent deactivated' : 'Agent reactivated');
      load();
    } catch (e) {
      flash(e.message || 'Update failed');
    }
  };

  const resend = async (a) => {
    const res = await inviteAgent(a.email, window.location.origin + '/login');
    flash(res.ok ? 'Invite re-sent to ' + a.email : 'Invite failed: ' + res.error);
  };

  return (
    <div>
      <TopBar title="Admin" kicker="Vendor console" right={<PropertyChip>All hotels</PropertyChip>} />

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 24px 80px' }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link to="/admin" style={{ color: 'var(--gray)', textDecoration: 'none' }}>Admin</Link>
          <span>›</span>
          <span style={{ color: 'var(--gray)' }}>{hotel ? hotel.name : '…'}</span>
          <span>›</span>
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Agents</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>
              {hotel ? hotel.name : 'Hotel'}{hotel && !hotel.active && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', background: 'var(--sunken)', padding: '2px 8px', borderRadius: 10, marginLeft: 10, verticalAlign: 'middle' }}>Inactive</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>
              Agents{hotel ? ' · ' + hotel.timezone : ''} · {agents.filter((a) => a.active).length} active
            </div>
          </div>
          <Link to="/admin" style={{ fontSize: 12.5, color: 'var(--gray)', textDecoration: 'none', padding: '7px 13px', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', background: '#fff' }}>← All hotels</Link>
        </div>

        {/* Add agent */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '14px 16px', margin: '16px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Add an agent</div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 12 }}>They'll get an email invite to set their password.</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <span style={lab}>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Chen" style={fld} />
            </div>
            <div style={{ flex: 1.4, minWidth: 200 }}>
              <span style={lab}>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@hotel.com" style={fld} />
            </div>
            <div style={{ width: 150 }}>
              <span style={lab}>Agent code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ING-1042" className="mono" style={fld} />
            </div>
            <button onClick={addAgent} disabled={!valid || adding}
              style={{ padding: '9px 16px', background: valid && !adding ? 'var(--teal)' : 'var(--line2)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, cursor: valid && !adding ? 'pointer' : 'not-allowed' }}>
              {adding ? 'Adding…' : '+ Add & invite'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 12.5, color: '#991B1B', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12 }}>{error}</div>
        )}

        {/* Agents table */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          <table>
            <thead><tr style={{ background: 'var(--sunken)' }}>
              {['Agent', 'Email', 'Code', 'Created', 'Status', ''].map((h, i) => (
                <th key={i} style={{ textAlign: 'left', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', padding: '9px 14px' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--line)', background: a.active ? '#fff' : '#FCFBF7', opacity: a.active ? 1 : 0.7 }}>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600 }}>{a.name}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--gray)' }}>{a.email}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--gray)' }} className="mono">{a.agent_code}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--gray)' }}>{fmtDate(a.created_at)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {a.active
                      ? <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-bg)', padding: '2px 8px', borderRadius: 10 }}>Active</span>
                      : <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--gray)', background: 'var(--sunken)', padding: '2px 8px', borderRadius: 10 }}>Inactive</span>}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => resend(a)} style={{ fontSize: 11.5, color: 'var(--gray)', background: 'none', border: 'none', marginRight: 12 }}>Resend invite</button>
                    <button onClick={() => toggleActive(a)} style={{ fontSize: 11.5, color: a.active ? '#DC2626' : 'var(--teal)', background: 'none', border: 'none' }}>{a.active ? 'Deactivate' : 'Activate'}</button>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={6} style={{ padding: '28px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>Loading…</td></tr>}
              {!loading && agents.length === 0 && <tr><td colSpan={6} style={{ padding: '28px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>No agents yet — add the first above.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Toast>{toast}</Toast>
    </div>
  );
}
