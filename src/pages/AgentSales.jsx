import { useState, useMemo } from 'react';
import { TopBar, PropertyChip } from '../components/TopBar.jsx';
import { Seg, KPI, Toast } from '../components/ui.jsx';
import { AGENTS, ROOM_TYPES, RT_RATE, OTHER_CATALOG, agentName } from '../data/catalog.js';
import { money, round5, DLABEL } from '../lib/format.js';
import { useCaptures, captureToLines } from '../store/captures.jsx';

const ROOM_PRODUCTS = ['Suite upgrade', 'Executive Room upgrade', 'Disney View upgrade', 'Deluxe King upgrade', 'Corner Room upgrade'];
const OTHER_PRODUCTS = ['Late checkout', 'Early arrival'];

// Deterministic pseudo-random line items across 30 days. Each captured product = one row.
function genRows() {
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const rows = [];
  let id = 1;
  const CONF = () => 'CN-' + (88000 + Math.floor(rnd() * 1800));
  for (let day = 0; day < 30; day++) {
    const dayCaptures = 4 + Math.floor(rnd() * 7); // 4–10 sales/day
    for (let c = 0; c < dayCaptures; c++) {
      const a = AGENTS[Math.floor(rnd() * AGENTS.length)];
      const conf = CONF();
      const room = ROOM_PRODUCTS[Math.floor(rnd() * ROOM_PRODUCTS.length)];
      const nights = 1 + Math.floor(rnd() * 4);
      const perNight = (Math.floor(rnd() * 8) + 5) * 5; // $25–$60
      rows.push({ id: id++, daysAgo: day, conf, agentId: a[0], agent: a[1], product: room, type: 'Room', qty: nights, unit: perNight, amount: perNight * nights });
      // ~45% also have an other-revenue line on the same confirmation
      if (rnd() < 0.45) {
        const op = OTHER_PRODUCTS[Math.floor(rnd() * OTHER_PRODUCTS.length)];
        const amt = round5(30 + Math.floor(rnd() * 4) * 5);
        rows.push({ id: id++, daysAgo: day, conf, agentId: a[0], agent: a[1], product: op, type: 'Other', qty: 1, unit: amt, amount: amt });
      }
    }
  }
  return rows;
}

export default function AgentSales() {
  const { captured } = useCaptures();
  const base = useMemo(genRows, []);
  const [extra, setExtra] = useState([]); // captured this session via the inline modal
  // Real captures made on the Capture Sale screen surface here as line items.
  const capturedLines = useMemo(() => captured.flatMap(captureToLines), [captured]);
  const all = useMemo(() => [...capturedLines, ...extra, ...base], [capturedLines, extra, base]);

  const [range, setRange] = useState('today'); // today | d7 | mtd
  const [view, setView] = useState('lines'); // lines | agents
  const [agentF, setAgentF] = useState('all');
  const [toast, setToast] = useState('');
  const [capOpen, setCapOpen] = useState(false);

  const maxDay = range === 'today' ? 0 : range === 'd7' ? 6 : 29;
  const rangeLabel = range === 'today' ? 'Today · 11 Jun' : range === 'd7' ? 'Last 7 days · 5–11 Jun' : 'MTD · 1–11 Jun';
  let rows = all.filter((r) => r.daysAgo <= maxDay);
  if (agentF !== 'all') rows = rows.filter((r) => r.agentId === agentF);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const roomRev = rows.filter((r) => r.type === 'Room').reduce((s, r) => s + r.amount, 0);
  const otherRev = rows.filter((r) => r.type === 'Other').reduce((s, r) => s + r.amount, 0);
  const confCount = new Set(rows.map((r) => r.conf)).size;

  // per-agent rollup
  const byAgent = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      const k = r.agentId;
      m[k] = m[k] || { agentId: r.agentId, agent: r.agent, room: 0, other: 0, lines: 0, confs: new Set() };
      m[k].lines++;
      m[k].confs.add(r.conf);
      m[k][r.type === 'Room' ? 'room' : 'other'] += r.amount;
    });
    return Object.values(m)
      .map((a) => ({ ...a, total: a.room + a.other, confs: a.confs.size }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const flash = (m) => {
    setToast(m);
    clearTimeout(window.__at);
    window.__at = setTimeout(() => setToast(''), 2200);
  };
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
      <TopBar title="Agent Sales" kicker="Captured upsells · all agents" right={<PropertyChip>Grand Horizon</PropertyChip>} />

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
          <KPI k="Total captured" v={money(total)} sub={rangeLabel.split('·')[0].trim()} accent="var(--teal)" />
          <KPI k="Room upgrades" v={money(roomRev)} sub={rows.filter((r) => r.type === 'Room').length + ' lines'} />
          <KPI k="Other revenue" v={money(otherRev)} sub={rows.filter((r) => r.type === 'Other').length + ' lines'} />
          <KPI k="Bookings · agents" v={confCount + ' · ' + byAgent.length} sub={rows.length + ' total lines'} />
        </div>

        {/* View toggle + agent filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <Seg opts={[['lines', 'Line items'], ['agents', 'By agent']]} val={view} set={setView} />
          <select value={agentF} onChange={(e) => setAgentF(e.target.value)} style={{ fontSize: 12.5, padding: '7px 10px', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', background: '#fff', marginLeft: 'auto' }}>
            <option value="all">All agents</option>
            {AGENTS.map((a) => <option key={a[0]} value={a[0]}>{a[1]}</option>)}
          </select>
        </div>

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
              </tbody>
            </table>
            <div style={{ padding: '10px 13px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--faint)' }}>
              <span>Showing {Math.min(40, rows.length)} of {rows.length} lines{rows.length > 40 ? ' · export for all' : ''}</span>
              <span>Day total · <strong style={{ color: 'var(--ink)' }}>{money(total)}</strong></span>
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
                  <tr key={a.agentId} style={{ borderTop: '1px solid var(--line)' }}>
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

      {capOpen && <CaptureModal onClose={() => setCapOpen(false)} onSubmit={(lines, msg) => { setExtra((x) => [...lines, ...x]); setCapOpen(false); flash(msg); }} />}
      <Toast prefix="↓">{toast}</Toast>
    </div>
  );
}

function CaptureModal({ onClose, onSubmit }) {
  const [conf, setConf] = useState('');
  const [agent, setAgent] = useState(AGENTS[0][0]);
  const [orig, setOrig] = useState('Deluxe King');
  const [up, setUp] = useState('Suite');
  const [nights, setNights] = useState(3);
  const [withRoom, setWithRoom] = useState(true);
  const [extras, setExtras] = useState([]); // [{name,price}]
  const delta = Math.max(0, RT_RATE[up] - RT_RATE[orig]);
  const roomAmt = delta * nights;
  const extrasAmt = extras.reduce((s, e) => s + (+e.price || 0), 0);
  const total = (withRoom ? roomAmt : 0) + extrasAmt;
  const addExtra = (name, price) => setExtras((e) => [...e, { name, price }]);
  const setExtra = (i, k, v) => setExtras((e) => e.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const rmExtra = (i) => setExtras((e) => e.filter((_, j) => j !== i));
  const aName = agentName(agent);
  const valid = conf.trim() && (withRoom || extras.length) && extras.every((e) => e.name.trim());
  const fld = { fontSize: 13, padding: '8px 10px', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', outline: 'none', width: '100%', background: '#fff' };
  const lab = { fontSize: 10.5, fontWeight: 600, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 };

  const submit = () => {
    const c = conf.trim().toUpperCase();
    const lines = [];
    let id = Date.now();
    if (withRoom) lines.push({ id: 'x' + id++, daysAgo: 0, conf: c, agentId: agent, agent: aName, product: up + ' upgrade', type: 'Room', qty: nights, unit: delta, amount: roomAmt });
    extras.forEach((e) => lines.push({ id: 'x' + id++, daysAgo: 0, conf: c, agentId: agent, agent: aName, product: e.name.trim(), type: 'Other', qty: 1, unit: +e.price || 0, amount: +e.price || 0 }));
    onSubmit(lines, lines.length + ' line' + (lines.length > 1 ? 's' : '') + ' captured · ' + aName);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 'var(--r)', boxShadow: '0 16px 48px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Capture a sale</div>
          <div style={{ fontSize: 12.5, color: 'var(--gray)', marginTop: 2 }}>Add a room upgrade and/or other revenue · each becomes a line.</div>
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><span style={lab}>Confirmation #</span><input value={conf} onChange={(e) => setConf(e.target.value)} placeholder="CN-XXXXX" className="mono" style={{ ...fld, textTransform: 'uppercase' }} /></div>
            <div><span style={lab}>Agent</span><select value={agent} onChange={(e) => setAgent(e.target.value)} style={fld}>{AGENTS.map((a) => <option key={a[0]} value={a[0]}>{a[1]}</option>)}</select></div>
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, borderTop: '1px solid var(--line)' }}>
          <span style={{ fontSize: 13, color: 'var(--gray)' }}>Total <strong className="mono" style={{ color: 'var(--ink)', fontSize: 15 }}>{money(total)}</strong></span>
          <button onClick={onClose} style={{ marginLeft: 'auto', padding: '10px 16px', background: '#fff', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 500 }}>Cancel</button>
          <button onClick={submit} disabled={!valid} style={{ padding: '10px 18px', background: valid ? 'var(--teal)' : 'var(--line2)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 600, cursor: valid ? 'pointer' : 'not-allowed' }}>Capture sale</button>
        </div>
      </div>
    </div>
  );
}
