import { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar.jsx';
import { Toggle } from '../components/ui.jsx';
import { ROOMS, RATE_PLANS } from '../data/catalog.js';
import { round5 } from '../lib/format.js';
import { fetchRoomRanks, saveRoomRanks } from '../store/roomStore.js';

// Brand-level master (inherited). Property can override rate + sellable + availability.
const MASTER = ROOMS.map((r) => ({ id: r.id, type: r.type, bed: r.bed, occ: r.occ, rate: r.rate, total: r.total, sellable: r.sellable, rank: r.rank }));
const byRank = (a, b) => a.rank - b.rank;
// availability sold tonight (for the Availability tab)
const SOLD = Object.fromEntries(ROOMS.map((r) => [r.id, r.sold]));

const Tab = ({ id, active, set, children, count }) => (
  <button
    onClick={() => set(id)}
    style={{
      padding: '9px 4px', marginRight: 22, background: 'none', border: 'none', fontSize: 13,
      fontWeight: active === id ? 600 : 500, color: active === id ? 'var(--ink)' : 'var(--gray)',
      borderBottom: '2px solid ' + (active === id ? 'var(--teal)' : 'transparent'), marginBottom: -1,
    }}
  >
    {children}
    {count != null && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--faint)' }}>{count}</span>}
  </button>
);

export default function RoomsAndRates() {
  const [prop, setProp] = useState('grand'); // grand | harbour
  const [tab, setTab] = useState('rooms');
  const [rows, setRows] = useState(MASTER.map((r) => ({ ...r })).sort(byRank));
  const [overridden, setOverridden] = useState({}); // id -> true if property-overridden
  const [editId, setEditId] = useState(null);
  const [dragId, setDragId] = useState(null); // room being dragged
  const [toast, setToast] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState('room'); // room | other
  const [draft, setDraft] = useState({ type: '', bed: 'King', occ: 2, rate: 0, total: 0 });
  const [oDraft, setODraft] = useState({ name: '', price: 0 });
  const [others, setOthers] = useState([
    { id: 'early', name: 'Early arrival', price: 35, sellable: true },
    { id: 'late', name: 'Late checkout', price: 40, sellable: true },
  ]);
  const toggleOther = (id) => setOthers((os) => os.map((o) => (o.id === id ? { ...o, sellable: !o.sellable } : o)));
  const flashMsg = (m) => {
    setToast(m);
    clearTimeout(window.__rt);
    window.__rt = setTimeout(() => setToast(''), 1900);
  };
  const addOther = () => {
    if (!oDraft.name.trim()) return;
    const o = { id: 'o' + Date.now(), name: oDraft.name.trim(), price: Math.max(0, Math.round((+oDraft.price || 0) / 5) * 5), sellable: true, isNew: true };
    setOthers((os) => [...os, o]);
    setAddOpen(false);
    setODraft({ name: '', price: 0 });
    flashMsg(o.name + ' added · sellable');
  };
  const addRoom = () => {
    if (!draft.type.trim()) return;
    const r = { id: 'r' + Date.now(), type: draft.type.trim(), bed: draft.bed, occ: Math.max(1, +draft.occ || 1), rate: Math.max(0, Math.round((+draft.rate || 0) / 5) * 5), total: Math.max(0, +draft.total || 0), sellable: true };
    setRows((rs) => [...rs, r]);
    setOverridden((o) => ({ ...o, [r.id]: true }));
    setAddOpen(false);
    setDraft({ type: '', bed: 'King', occ: 2, rate: 0, total: 0 });
    flashMsg(r.type + ' added · sellable');
  };

  const flash = (m) => {
    setToast(m);
    clearTimeout(window.__t);
    window.__t = setTimeout(() => setToast(''), 1900);
  };

  // Load persisted ranks (falls back to catalog rank if the table is empty).
  useEffect(() => {
    fetchRoomRanks()
      .then((ranks) => {
        if (!ranks || !ranks.length) return;
        const rankById = Object.fromEntries(ranks.map((r) => [r.id, r.rank]));
        setRows((rs) => rs.map((r) => ({ ...r, rank: rankById[r.id] ?? r.rank })).sort(byRank));
      })
      .catch(() => {});
  }, []);

  // Drag-to-reorder: move dragged room to the drop target's slot, renumber ranks
  // 1..N, update optimistically, then persist (revert on failure).
  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const prev = rows;
    const ordered = [...rows].sort(byRank);
    const from = ordered.findIndex((r) => r.id === dragId);
    const to = ordered.findIndex((r) => r.id === targetId);
    if (from < 0 || to < 0) { setDragId(null); return; }
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reranked = next.map((r, i) => ({ ...r, rank: i + 1 }));
    setRows(reranked);
    setDragId(null);
    saveRoomRanks(reranked.map((r) => ({ id: r.id, type: r.type, rank: r.rank })))
      .then(() => flash('Upgrade order saved'))
      .catch((e) => { setRows(prev); flash(e.message || 'Could not save order'); });
  };

  const patch = (id, field, val) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
    setOverridden((o) => ({ ...o, [id]: true }));
  };
  const revert = (id) => {
    const m = MASTER.find((x) => x.id === id);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...m } : r)));
    setOverridden((o) => {
      const n = { ...o };
      delete n[id];
      return n;
    });
    flash(m.type + ' reverted to brand default');
  };

  const sellableN = rows.filter((r) => r.sellable).length;
  const ovN = Object.keys(overridden).length;

  return (
    <div>
      <TopBar
        title="Rooms & Rates"
        kicker="Sell · base products"
        right={
          <div style={{ display: 'inline-flex', border: '1px solid var(--line2)', borderRadius: 6, overflow: 'hidden', fontSize: 12 }}>
            <button onClick={() => setProp('grand')} style={{ padding: '6px 12px', border: 'none', background: prop === 'grand' ? 'var(--sunken)' : '#fff', fontWeight: prop === 'grand' ? 600 : 400, color: 'var(--ink)' }}>Grand Horizon</button>
            <button onClick={() => setProp('harbour')} style={{ padding: '6px 12px', border: 'none', borderLeft: '1px solid var(--line2)', background: prop === 'harbour' ? 'var(--sunken)' : '#fff', fontWeight: prop === 'harbour' ? 600 : 400, color: 'var(--ink)' }}>Harbour View</button>
          </div>
        }
      />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 24px 80px' }}>
        {/* Page head */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>Rooms &amp; Rates</div>
            <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>Base room products an agent can sell directly · the layer beneath the Offer Catalog</div>
          </div>
          <button onClick={() => { setAddMode(tab === 'other' ? 'other' : 'room'); setAddOpen(true); }} style={{ padding: '9px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600 }}>+ Add product</button>
        </div>

        {/* inherit/override banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', background: 'var(--blue-bg)', border: '1px solid #C7D6F5', borderRadius: 'var(--r)', fontSize: 12.5, marginBottom: 16 }}>
          <span style={{ color: 'var(--blue)', fontWeight: 600 }}>◆ {prop === 'grand' ? 'Grand Horizon' : 'Harbour View'}</span>
          <span style={{ color: 'var(--gray)' }}>Inherits the <strong>Horizon Collection</strong> room master. {ovN > 0 ? ovN + ' room' + (ovN > 1 ? 's' : '') + ' overridden for this property.' : 'No overrides — using brand defaults.'}</span>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--line)', marginBottom: 18 }}>
          <Tab id="rooms" active={tab} set={setTab} count={rows.length}>Rooms</Tab>
          <Tab id="other" active={tab} set={setTab} count={others.length}>Other revenue</Tab>
          <Tab id="avail" active={tab} set={setTab}>Availability</Tab>
          <Tab id="plans" active={tab} set={setTab} count={RATE_PLANS.length}>Rate plans</Tab>
        </div>

        {/* OTHER REVENUE TAB */}
        {tab === 'other' && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <table>
              <thead><tr style={{ background: 'var(--sunken)' }}>
                {['Product', 'Price', 'Sellable', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: i === 1 ? 'right' : 'left', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', padding: '9px 14px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {others.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid var(--line)', background: o.isNew ? '#FCFBF7' : '#fff' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
                      {o.name}{o.isNew && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 6px', borderRadius: 10 }}>New</span>}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right' }} className="mono"><span style={{ fontSize: 13, fontWeight: 600 }}>${o.price}</span></td>
                    <td style={{ padding: '11px 14px' }}><Toggle on={o.sellable} onClick={() => toggleOther(o.id)} /></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--faint)' }}>
              Other revenue products (e.g. breakfast voucher, parking) an agent can add to a sale in Capture Sale.
            </div>
          </div>
        )}

        {/* ROOMS TAB */}
        {tab === 'rooms' && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <table>
              <thead><tr style={{ background: 'var(--sunken)' }}>
                <th style={{ width: 30, padding: '9px 0 9px 12px' }} />
                {['Room type', 'Bed / occ.', 'Base rate / night', 'Inventory', 'Sellable', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: i === 2 || i === 3 ? 'right' : 'left', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', padding: '9px 14px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.slice().sort(byRank).map((r) => {
                  const ov = overridden[r.id];
                  return (
                    <tr key={r.id}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={() => onDrop(r.id)}
                      style={{ borderTop: '1px solid var(--line)', background: ov ? '#FCFBF7' : '#fff', opacity: dragId === r.id ? 0.4 : 1 }}>
                      <td style={{ padding: '11px 0 11px 12px', width: 30 }}>
                        <span draggable onDragStart={() => setDragId(r.id)} onDragEnd={() => setDragId(null)} title="Drag to reorder"
                          style={{ cursor: 'grab', color: 'var(--faint)', fontSize: 15, lineHeight: 1, userSelect: 'none', display: 'inline-block' }}>⠿</span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
                          {r.type}
                          {ov && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 6px', borderRadius: 10 }}>Overridden</span>}
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--gray)' }}>{r.bed} · {r.occ}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                        {editId === r.id ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            $<input className="mono" type="number" step="5" defaultValue={r.rate} autoFocus
                              onBlur={(e) => { patch(r.id, 'rate', round5(parseInt(e.target.value || '0', 10))); setEditId(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                              style={{ width: 62, fontSize: 13, fontWeight: 600, border: '1px solid var(--teal)', borderRadius: 4, padding: '3px 5px', textAlign: 'right' }} />
                          </span>
                        ) : (
                          <button onClick={() => setEditId(r.id)} className="mono" style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderBottom: '1px dashed var(--line2)', padding: 0 }}>${r.rate}</button>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--gray)' }} className="mono">{r.total} rooms</td>
                      <td style={{ padding: '11px 14px' }}><Toggle on={r.sellable} onClick={() => patch(r.id, 'sellable', !r.sellable)} /></td>
                      <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                        {ov && <button onClick={() => revert(r.id)} style={{ fontSize: 11.5, color: 'var(--teal)', background: 'none', border: 'none' }}>Revert</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: '11px 14px', borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--faint)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{sellableN} of {rows.length} sellable · tap a rate to edit (rounds to $5)</span>
              <span>Upsell deltas in the Offer Catalog compute from these base rates</span>
            </div>
          </div>
        )}

        {/* AVAILABILITY TAB */}
        {tab === 'avail' && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Availability · tonight <span style={{ fontWeight: 400, color: 'var(--faint)', fontSize: 11.5 }}>· 11 Jun</span></div>
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Live from PMS · the no-oversell guard</span>
            </div>
            <table>
              <thead><tr style={{ background: 'var(--sunken)' }}>
                {['Room type', 'Total', 'Sold', 'Available', 'Occupancy', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: i >= 1 && i <= 3 ? 'right' : 'left', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', padding: '9px 14px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const sold = SOLD[r.id] || 0;
                  const avail = r.total - sold;
                  const occ = Math.round((sold / r.total) * 100);
                  const low = avail <= 4;
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '11px 14px', fontWeight: 600, fontSize: 13 }}>{r.type}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--gray)' }}>{r.total}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--gray)' }}>{sold}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: low ? 'var(--crit)' : 'var(--ink)' }}>{avail}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 90, height: 6, background: 'var(--sunken)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: occ + '%', height: '100%', background: occ >= 85 ? 'var(--crit)' : occ >= 65 ? 'var(--amber)' : 'var(--teal)' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{occ}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'right' }}>{low && <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--crit)', background: 'var(--crit-bg)', padding: '2px 7px', borderRadius: 10 }}>Low</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: '11px 14px', borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--faint)' }}>
              Sellable rooms can't be sold below 0 available — Capture Sale blocks oversell against these counts.
            </div>
          </div>
        )}

        {/* RATE PLANS TAB */}
        {tab === 'plans' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {RATE_PLANS.map((p) => (
              <div key={p.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.name}
                    {p.default && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-bg)', padding: '2px 7px', borderRadius: 10 }}>Default</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 3 }}>{p.basis} · {p.cancel}</div>
                </div>
                <button style={{ fontSize: 12, color: 'var(--gray)', background: 'none', border: '1px solid var(--line2)', borderRadius: 5, padding: '6px 12px' }}>Edit</button>
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'var(--gray)', background: 'var(--sunken)', borderRadius: 'var(--r)', padding: '12px 14px', display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--brass)' }}>⚙</span>
              <span>Currency <strong>USD</strong> · prices round to <strong>$5</strong> · rate plans apply per room type. Per-stay plans bill once; per-night multiply by stay length.</span>
            </div>
          </div>
        )}
      </div>

      {addOpen && (
        <div onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, background: '#fff', borderRadius: 'var(--r)', boxShadow: '0 16px 48px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Add product</div>
              <div style={{ fontSize: 12.5, color: 'var(--gray)', marginTop: 2, marginBottom: 11 }}>A new sellable product for {prop === 'grand' ? 'Grand Horizon' : 'Harbour View'}.</div>
              <div style={{ display: 'inline-flex', background: 'var(--sunken)', borderRadius: 6, padding: 2, gap: 2 }}>
                {[['room', 'Room type'], ['other', 'Other revenue']].map(([k, l]) => (
                  <button key={k} onClick={() => setAddMode(k)} style={{ padding: '6px 14px', border: 'none', borderRadius: 4, fontSize: 12.5, fontWeight: addMode === k ? 600 : 500, background: addMode === k ? '#fff' : 'transparent', color: addMode === k ? 'var(--ink)' : 'var(--gray)', boxShadow: addMode === k ? '0 1px 2px rgba(0,0,0,.06)' : 'none' }}>{l}</button>
                ))}
              </div>
            </div>
            {addMode === 'room' ? (
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Room type name</span>
                  <input value={draft.type} autoFocus onChange={(e) => setDraft({ ...draft, type: e.target.value })} placeholder="e.g. Garden Suite" style={{ fontSize: 14, padding: '9px 11px', border: '1px solid ' + (draft.type.trim() ? 'var(--line2)' : '#FCA5A5'), borderRadius: 'var(--r-sm)', outline: 'none', width: '100%' }} />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Bed</span>
                    <select value={draft.bed} onChange={(e) => setDraft({ ...draft, bed: e.target.value })} style={{ fontSize: 14, padding: '9px 11px', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', outline: 'none', width: '100%', background: '#fff' }}>
                      {['King', 'Queen', '2 Queen', 'Twin', 'Suite'].map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Max occupancy</span>
                    <input type="number" min="1" value={draft.occ} onChange={(e) => setDraft({ ...draft, occ: e.target.value })} className="mono" style={{ fontSize: 14, padding: '9px 11px', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', outline: 'none', width: '100%' }} />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Base rate / night <span style={{ color: 'var(--faint)', fontWeight: 400 }}>· $5</span></span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', padding: '9px 11px' }}>
                      <span style={{ color: 'var(--faint)' }}>$</span>
                      <input type="number" step="5" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} className="mono" style={{ width: '100%', border: 'none', outline: 'none', fontWeight: 600 }} />
                    </div>
                  </label>
                  <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Inventory · rooms</span>
                    <input type="number" min="0" value={draft.total} onChange={(e) => setDraft({ ...draft, total: e.target.value })} className="mono" style={{ fontSize: 14, padding: '9px 11px', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', outline: 'none', width: '100%' }} />
                  </label>
                </div>
              </div>
            ) : (
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Product name</span>
                  <input value={oDraft.name} autoFocus onChange={(e) => setODraft({ ...oDraft, name: e.target.value })} placeholder="e.g. Breakfast voucher" style={{ fontSize: 14, padding: '9px 11px', border: '1px solid ' + (oDraft.name.trim() ? 'var(--line2)' : '#FCA5A5'), borderRadius: 'var(--r-sm)', outline: 'none', width: '100%' }} />
                </label>
                <label style={{ display: 'block', width: 160 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Price <span style={{ color: 'var(--faint)', fontWeight: 400 }}>· $5</span></span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', padding: '9px 11px' }}>
                    <span style={{ color: 'var(--faint)' }}>$</span>
                    <input type="number" step="5" value={oDraft.price} onChange={(e) => setODraft({ ...oDraft, price: e.target.value })} className="mono" style={{ width: '100%', border: 'none', outline: 'none', fontWeight: 600 }} />
                  </div>
                </label>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid var(--line)' }}>
              <button onClick={() => setAddOpen(false)} style={{ flex: '0 0 auto', padding: '11px 18px', background: '#fff', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 500 }}>Cancel</button>
              {addMode === 'room'
                ? <button onClick={addRoom} disabled={!draft.type.trim()} style={{ flex: 1, padding: '11px', background: draft.type.trim() ? 'var(--teal)' : 'var(--line2)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 600, cursor: draft.type.trim() ? 'pointer' : 'not-allowed' }}>+ Add room type</button>
                : <button onClick={addOther} disabled={!oDraft.name.trim()} style={{ flex: 1, padding: '11px', background: oDraft.name.trim() ? 'var(--teal)' : 'var(--line2)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 600, cursor: oDraft.name.trim() ? 'pointer' : 'not-allowed' }}>+ Add other revenue</button>}
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: '#fff', padding: '11px 16px', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 500, boxShadow: '0 12px 32px rgba(0,0,0,.2)' }}>✓ {toast}</div>}
    </div>
  );
}
