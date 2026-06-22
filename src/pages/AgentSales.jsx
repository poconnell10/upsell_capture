import { useState, useMemo, useEffect, useCallback } from 'react';
import { TopBar, PropertyChip } from '../components/TopBar.jsx';
import { Seg, KPI, Toast } from '../components/ui.jsx';
import { ROOM_TYPES, RT_RATE, OTHER_CATALOG } from '../data/catalog.js';
import { money, DLABEL } from '../lib/format.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fetchCaptures, fetchAgents, insertCaptures, rangeBounds } from '../store/captureStore.js';

export default function AgentSales() {
  const { agent: me, isVendor } = useAuth();

  const [range, setRange] = useState('today'); // today | d7 | mtd
  const [view, setView] = useState('lines'); // lines | agents
  const [agentF, setAgentF] = useState('all'); // 'all' | agents.id
  const [toast, setToast] = useState('');
  const [capOpen, setCapOpen] = useState(false);

  const [agents, setAgents] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const flash = (m) => {
    setToast(m);
    clearTimeout(window.__at);
    window.__at = setTimeout(() => setToast(''), 2200);
  };

  useEffect(() => {
    fetchAgents().then(setAgents).catch(() => setAgents([]));
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const { from, to } = rangeBounds(range);
    fetchCaptures({ from, to, agentId: agentF === 'all' ? undefined : agentF })
      .then((r) => { if (active) { setRows(r); setError(''); } })
      .catch((e) => { if (active) setError(e.message || 'Failed to load captures'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range, agentF, refreshKey]);

  const rangeLabel = range === 'today' ? 'Today' : range === 'd7' ? 'Last 7 days' : 'Month to date';

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const roomRev = rows.filter((r) => r.type === 'Room').reduce((s, r) => s + r.amount, 0);
  const otherRev = rows.filter((r) => r.type === 'Other').reduce((s, r) => s + r.amount, 0);
  const confCount = new Set(rows.map((r) => r.conf)).size;

  // per-agent rollup
  const byAgent = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      const k = r.agentUuid || r.agentId;
      m[k] = m[k] || { agentId: r.agentId, agent: r.agent, room: 0, other: 0, lines: 0, confs: new Set() };
      m[k].lines++;
      m[k].confs.add(r.conf);
      m[k][r.type === 'Room' ? 'room' : 'other'] += r.amount;
    });
    return Object.values(m)
      .map((a) => ({ ...a, total: a.room + a.other, confs: a.confs.size }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const exportCsv = () => {
    const head = ['Date', 'Confirmation', 'Agent ID', 'Agent', 'Product', 'Type', 'Qty', 'Unit', 'Amount'];
    const lines = rows.map((r) => [DLABEL(r.daysAgo), r.conf, r.agentId, r.agent, r.product, r.type, r.qty, r.unit, r.amount].join(','));
    const csv = [head.join(','), ...lines].join('\n');
    try {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'agent-sales-' + range + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      /* ignore */
    }
    flash(rows.length + ' rows exported · ' + rangeLabel);
  };

  return (
    <div>
      <TopBar title="Agent Sales" kicker="Captured upsells" right={<PropertyChip>{isVendor ? 'All hotels' : me?.name ? me.name : 'Grand Horizon'}</PropertyChip>} />

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 24px 80px' }}>
        {/* Head + controls */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>Agent Sales</div>
            <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>Every captured product is a line · {rangeLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Seg opts={[['today', 'Today'], ['d7', '7 days'], ['mtd', 'MTD']]} val={range} set={setRange} />
            <button onClick={() => setCapOpen(true)} style={{ padding: '7px 13px', background: 'var(--teal)', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 600, color: '#fff' }}>+ Capture sale</button>
            <button onClick={exportCsv} style={{ padding: '7px 13px', background: '#fff', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>↓ Export CSV</button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          <KPI k="Total captured" v={money(total)} sub={rangeLabel} accent="var(--teal)" />
          <KPI k="Room upgrades" v={money(roomRev)} sub={rows.filter((r) => r.type === 'Room').length + ' lines'} />
          <KPI k="Other revenue" v={money(otherRev)} sub={rows.filter((r) => r.type === 'Other').length + ' lines'} />
          <KPI k="Bookings · agents" v={confCount + ' · ' + byAgent.length} sub={rows.length + ' total lines'} />
        </div>

        {/* View toggle + agent filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <Seg opts={[['lines', 'Line items'], ['agents', 'By agent']]} val={view} set={setView} />
          <select value={agentF} onChange={(e) => setAgentF(e.target.value)} style={{ fontSize: 12.5, padding: '7px 10px', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', background: '#fff', marginLeft: 'auto' }}>
            <option value="all">All agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {error && (
          <div style={{ fontSize: 12.5, color: '#991B1B', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* LINE ITEMS */}
        {view === 'lines' && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <table>
              <thead><tr style={{ background: 'var(--sunken)' }}>
                {['When', 'Confirmation', 'Agent', 'Product', 'Type', 'Qty', 'Unit', 'Amount'].map((h, i) => (
                  <th key={i} style={{ textAlign: i >= 5 ? 'right' : 'left', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', padding: '9px 13px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.slice(0, 40).map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '9px 13px', fontSize: 12, color: 'var(--gray)' }}>{DLABEL(r.daysAgo)}</td>
                    <td style={{ padding: '9px 13px' }} className="mono"><span style={{ fontSize: 11.5, color: 'var(--teal)' }}>{r.conf}</span></td>
                    <td style={{ padding: '9px 13px', fontSize: 12.5 }}>{r.agent}<div className="mono" style={{ fontSize: 10, color: 'var(--faint)' }}>{r.agentId}</div></td>
                    <td style={{ padding: '9px 13px', fontSize: 12.5, fontWeight: 500 }}>{r.product}</td>
                    <td style={{ padding: '9px 13px' }}><span style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: r.type === 'Room' ? 'var(--teal-bg)' : '#FEF3C7', color: r.type === 'Room' ? 'var(--teal)' : 'var(--amber)' }}>{r.type}</span></td>
                    <td style={{ padding: '9px 13px', textAlign: 'right', fontSize: 12.5, color: 'var(--gray)' }} className="mono">{r.qty}{r.type === 'Room' ? 'n' : ''}</td>
                    <td style={{ padding: '9px 13px', textAlign: 'right', fontSize: 12.5, color: 'var(--gray)' }} className="mono">${r.unit}</td>
                    <td style={{ padding: '9px 13px', textAlign: 'right', fontSize: 13, fontWeight: 600 }} className="mono">{money(r.amount)}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '28px 13px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>No captures in this range yet.</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={8} style={{ padding: '28px 13px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>Loading…</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ padding: '10px 13px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--faint)' }}>
              <span>Showing {Math.min(40, rows.length)} of {rows.length} lines{rows.length > 40 ? ' · export for all' : ''}</span>
              <span>Range total · <strong style={{ color: 'var(--ink)' }}>{money(total)}</strong></span>
            </div>
          </div>
        )}

        {/* BY AGENT */}
        {view === 'agents' && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <table>
              <thead><tr style={{ background: 'var(--sunken)' }}>
                {['Agent', 'Bookings', 'Lines', 'Room upsell', 'Other rev', 'Total'].map((h, i) => (
                  <th key={i} style={{ textAlign: i >= 1 ? 'right' : 'left', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', padding: '9px 14px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {byAgent.map((a, i) => (
                  <tr key={a.agentId + i} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--sunken)', fontSize: 10, fontWeight: 700, color: 'var(--gray)', display: 'grid', placeItems: 'center' }}>{i + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{a.agent}<span className="mono" style={{ fontSize: 10, color: 'var(--faint)', marginLeft: 7, fontWeight: 400 }}>{a.agentId}</span></span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--gray)' }} className="mono">{a.confs}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--gray)' }} className="mono">{a.lines}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5 }} className="mono">{money(a.room)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--amber)' }} className="mono">{money(a.other)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--teal)' }} className="mono">{money(a.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{ borderTop: '2px solid var(--line2)', background: 'var(--sunken)' }}>
                <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700 }}>All agents</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--gray)' }} className="mono">{confCount}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--gray)' }} className="mono">{rows.length}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600 }} className="mono">{money(roomRev)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--amber)' }} className="mono">{money(otherRev)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--teal)' }} className="mono">{money(total)}</td>
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>

      {capOpen && (
        <CaptureModal
          me={me}
          isVendor={isVendor}
          agents={agents}
          onClose={() => setCapOpen(false)}
          onDone={(msg) => { setCapOpen(false); setRefreshKey((k) => k + 1); flash(msg); }}
        />
      )}
      <Toast prefix="↓">{toast}</Toast>
    </div>
  );
}

function CaptureModal({ me, isVendor, agents, onClose, onDone }) {
  // Non-vendor agents can only capture as themselves (RLS enforces this too).
  const selectable = isVendor ? agents : me ? [me] : [];
  const [conf, setConf] = useState('');
  const [agentId, setAgentId] = useState(me?.id || selectable[0]?.id || '');
  const [orig, setOrig] = useState('Deluxe King');
  const [up, setUp] = useState('Suite');
  const [nights, setNights] = useState(3);
  const [withRoom, setWithRoom] = useState(true);
  const [extras, setExtras] = useState([]); // [{name,price}]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const delta = Math.max(0, RT_RATE[up] - RT_RATE[orig]);
  const roomAmt = delta * nights;
  const extrasAmt = extras.reduce((s, e) => s + (+e.price || 0), 0);
  const total = (withRoom ? roomAmt : 0) + extrasAmt;
  const addExtra = (name, price) => setExtras((e) => [...e, { name, price }]);
  const setExtra = (i, k, v) => setExtras((e) => e.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const rmExtra = (i) => setExtras((e) => e.filter((_, j) => j !== i));
  const selAgent = selectable.find((a) => a.id === agentId);
  const valid = conf.trim() && selAgent && (withRoom || extras.length) && extras.every((e) => e.name.trim());
  const fld = { fontSize: 13, padding: '8px 10px', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', outline: 'none', width: '100%', background: '#fff' };
  const lab = { fontSize: 10.5, fontWeight: 600, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 };

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    const c = conf.trim().toUpperCase();
    const base = { hotelId: selAgent.hotel_id, agentId: selAgent.id, confirmation: c };
    const lines = [];
    if (withRoom) lines.push({ ...base, product: up + ' upgrade', type: 'Room', qty: nights, unitPrice: delta, amount: roomAmt });
    extras.forEach((e) => lines.push({ ...base, product: e.name.trim(), type: 'Other', qty: 1, unitPrice: +e.price || 0, amount: +e.price || 0 }));
    try {
      await insertCaptures(lines);
      onDone(lines.length + ' line' + (lines.length > 1 ? 's' : '') + ' captured · ' + (selAgent.name || ''));
    } catch (e) {
      setBusy(false);
      setError(e.message || 'Capture failed.');
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 'var(--r)', boxShadow: '0 16px 48px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Capture a sale</div>
          <div style={{ fontSize: 12.5, color: 'var(--gray)', marginTop: 2 }}>Add a room upgrade and/or other revenue · each becomes a line.</div>
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!me && !isVendor && (
            <div style={{ fontSize: 11.5, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
              Your login isn't linked to an agent profile, so captures can't be saved.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><span style={lab}>Confirmation #</span><input value={conf} onChange={(e) => setConf(e.target.value)} placeholder="CN-XXXXX" className="mono" style={{ ...fld, textTransform: 'uppercase' }} /></div>
            <div>
              <span style={lab}>Agent</span>
              <select value={agentId} onChange={(e) => setAgentId(e.target.value)} disabled={!isVendor} style={fld}>
                {selectable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Room type */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, marginBottom: withRoom ? 12 : 0 }}>
              <input type="checkbox" checked={withRoom} onChange={(e) => setWithRoom(e.target.checked)} /> Room upgrade
            </label>
            {withRoom && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><span style={lab}>Original</span><select value={orig} onChange={(e) => setOrig(e.target.value)} style={fld}>{ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                  <div><span style={lab}>Upgrade to</span><select value={up} onChange={(e) => setUp(e.target.value)} style={fld}>{ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                  <label style={{ fontSize: 12, color: 'var(--gray)', display: 'flex', alignItems: 'center', gap: 6 }}>Nights <input type="number" min="1" value={nights} onChange={(e) => setNights(Math.max(1, +e.target.value || 1))} className="mono" style={{ width: 50, ...fld, padding: '5px 6px', textAlign: 'center' }} /></label>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray)' }}>+${delta}/n × {nights} =</span>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal)' }}>{money(roomAmt)}</span>
                </div>
              </>
            )}
          </div>

          {/* Other revenue */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: extras.length ? 10 : 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Other revenue</span>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {OTHER_CATALOG.map(([n, p]) => <button key={n} onClick={() => addExtra(n, p)} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 20, border: '1px solid var(--line2)', background: '#fff', color: 'var(--teal)' }}>+ {n}</button>)}
                <button onClick={() => addExtra('', 0)} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 20, border: '1px dashed var(--line2)', background: '#fff', color: 'var(--gray)' }}>+ Custom</button>
              </div>
            </div>
            {extras.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--line)' }}>
                <input value={e.name} onChange={(ev) => setExtra(i, 'name', ev.target.value)} placeholder="Product name…" style={{ flex: 1, ...fld, padding: '5px 8px', border: '1px solid ' + (e.name.trim() ? 'var(--line2)' : '#FCA5A5') }} />
                <span style={{ color: 'var(--faint)' }}>$</span>
                <input type="number" step="5" value={e.price} onChange={(ev) => setExtra(i, 'price', ev.target.value)} className="mono" style={{ width: 60, ...fld, padding: '5px 6px', textAlign: 'right' }} />
                <button onClick={() => rmExtra(i)} style={{ fontSize: 11, color: 'var(--gray)', background: 'none', border: 'none' }}>✕</button>
              </div>
            ))}
          </div>
          {error && <div style={{ fontSize: 12, color: '#991B1B', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>{error}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, borderTop: '1px solid var(--line)' }}>
          <span style={{ fontSize: 13, color: 'var(--gray)' }}>Total <strong className="mono" style={{ color: 'var(--ink)', fontSize: 15 }}>{money(total)}</strong></span>
          <button onClick={onClose} style={{ marginLeft: 'auto', padding: '10px 16px', background: '#fff', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 500 }}>Cancel</button>
          <button onClick={submit} disabled={!valid || busy} style={{ padding: '10px 18px', background: valid && !busy ? 'var(--teal)' : 'var(--line2)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 600, cursor: valid && !busy ? 'pointer' : 'not-allowed' }}>{busy ? 'Saving…' : 'Capture sale'}</button>
        </div>
      </div>
    </div>
  );
}
