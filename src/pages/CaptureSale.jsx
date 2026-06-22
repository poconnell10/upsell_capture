import { useState, useEffect, useMemo, useCallback } from 'react';
import { TopBar, PropertyChip } from '../components/TopBar.jsx';
import { Row, Stat, Toast } from '../components/ui.jsx';
import { ROOMS, PRODUCTS, rateOf, availOf } from '../data/catalog.js';
import { round5, money } from '../lib/format.js';
import { useLocalStorage } from '../lib/useLocalStorage.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { fetchCaptures, insertCaptures, deleteCaptures, groupByConfirmation, rangeBounds } from '../store/captureStore.js';

const lbl = {
  fontSize: 11, fontWeight: 600, color: 'var(--gray)', letterSpacing: '.02em',
  display: 'block', marginBottom: 5,
};
const inp = {
  fontSize: 14, padding: '9px 11px', border: '1px solid var(--line2)',
  borderRadius: 'var(--r-sm)', outline: 'none', width: '100%', background: '#fff',
};

function Shell({ children }) {
  return (
    <div>
      <TopBar title="Capture Sale" kicker="Room upgrade · front desk" right={<PropertyChip>Front desk</PropertyChip>} />
      {children}
    </div>
  );
}

export default function CaptureSale() {
  const { agent: me } = useAuth();

  const [conf, setConf] = useState('');
  const [orig, setOrig] = useState('');
  const [origRate, setOrigRate] = useState(0);
  const [up, setUp] = useState('');
  const [upRate, setUpRate] = useState(0);
  const [nights, setNights] = useState(3);
  const [extras, setExtras] = useState([]); // [{id,name,price,custom?}]
  const [done, setDone] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewSale, setViewSale] = useState(null); // a confirmation group
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [captured, setCaptured] = useState([]); // today's capture line items (UI rows)
  const [drafts, saveDrafts] = useLocalStorage('bm_capture_drafts', []);
  const [toast, setToast] = useState('');
  const flash = (m) => {
    setToast(m);
    clearTimeout(window.__ct);
    window.__ct = setTimeout(() => setToast(''), 2200);
  };

  // Load today's captures for this agent.
  const reload = useCallback(() => {
    if (!me) {
      setCaptured([]);
      return;
    }
    const { from } = rangeBounds('today');
    fetchCaptures({ from, agentId: me.id })
      .then(setCaptured)
      .catch(() => setCaptured([]));
  }, [me]);

  useEffect(() => { reload(); }, [reload]);

  const groups = useMemo(() => groupByConfirmation(captured), [captured]);

  const pickOrig = (t) => { setOrig(t); setOrigRate(rateOf(t)); };
  const pickUp = (t) => { setUp(t); setUpRate(rateOf(t)); };
  const addExtra = (id) => {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    if (extras.some((e) => e.id === id)) return;
    setExtras((e) => [...e, { ...p }]);
  };
  const addCustom = () => setExtras((e) => [...e, { id: 'c' + Date.now(), name: '', price: 0, custom: true }]);
  const setExtraName = (id, v) => setExtras((e) => e.map((x) => (x.id === id ? { ...x, name: v } : x)));
  const setExtraPrice = (id, v) =>
    setExtras((e) => e.map((x) => (x.id === id ? { ...x, price: round5(parseInt(v, 10) || 0) } : x)));
  const removeExtra = (id) => setExtras((e) => e.filter((x) => x.id !== id));

  const perNight = Math.max(0, upRate - origRate); // upgrade delta / night
  const roomTotal = perNight * nights;
  const extrasTotal = extras.reduce((s, e) => s + (e.price || 0), 0);
  const total = roomTotal + extrasTotal;

  const valid =
    Boolean(me) && conf.trim() && orig && up && up !== orig && nights > 0 && extras.every((e) => e.name.trim());

  // Guard signals (against today's loaded captures)
  const dup = conf.trim() && captured.some((c) => c.conf === conf.trim().toUpperCase());
  const upAvail = up ? availOf(up) : 99;
  const soldSame = up ? captured.filter((c) => c.product === up + ' upgrade').length : 0;
  const oversold = up && soldSame >= upAvail;

  const doCapture = async () => {
    if (!me || busy) return;
    setBusy(true);
    setSubmitError('');
    const c = conf.trim().toUpperCase();
    const base = { hotelId: me.hotel_id, agentId: me.id, confirmation: c };
    const lines = [];
    if (roomTotal > 0) lines.push({ ...base, product: up + ' upgrade', type: 'Room', qty: nights, unitPrice: perNight, amount: roomTotal });
    extras.forEach((e) => lines.push({ ...base, product: e.name.trim(), type: 'Other', qty: 1, unitPrice: e.price || 0, amount: e.price || 0 }));
    try {
      const inserted = await insertCaptures(lines);
      setConfirmOpen(false);
      setDone({
        ref: inserted[0]?.id ? inserted[0].id.slice(0, 8).toUpperCase() : '—',
        conf: c,
        agent: me.agent_code,
        orig, up, perNight, nights, roomTotal,
        extras: [...extras],
        total,
      });
      reload();
    } catch (e) {
      setSubmitError(e.message || 'Capture failed.');
    } finally {
      setBusy(false);
    }
  };

  const voidGroup = async (group) => {
    try {
      await deleteCaptures(group.lines.map((l) => l.id));
      setViewSale(null);
      reload();
      flash('Sale voided · reversed in reconciliation');
    } catch (e) {
      flash(e.message || 'Void failed');
    }
  };

  const reset = () => {
    setConf(''); setOrig(''); setOrigRate(0); setUp(''); setUpRate(0);
    setNights(3); setExtras([]); setDone(null); setConfirmOpen(false); setSubmitError('');
  };
  const dirty = conf.trim() || orig || up || extras.length;
  const saveDraft = () => {
    if (!dirty) return;
    const d = {
      id: 'd' + Date.now(), conf: conf.trim().toUpperCase() || '(no conf)', orig, origRate,
      up, upRate, nights, extras: [...extras], total, when: 'Just now',
    };
    saveDrafts((ds) => [d, ...ds]);
    reset();
    flash('Saved as draft · resume any time');
  };
  const resumeDraft = (d) => {
    setConf(d.conf === '(no conf)' ? '' : d.conf);
    setOrig(d.orig); setOrigRate(d.origRate); setUp(d.up); setUpRate(d.upRate);
    setNights(d.nights); setExtras(d.extras || []);
    saveDrafts((ds) => ds.filter((x) => x.id !== d.id));
    flash('Draft resumed');
  };
  const discardDraft = (id) => {
    saveDrafts((ds) => ds.filter((x) => x.id !== id));
    flash('Draft discarded');
  };

  if (done) {
    return (
      <Shell>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--teal-line)', borderRadius: 'var(--r)', padding: '30px 26px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--teal-bg)', border: '1px solid var(--teal-line)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', fontSize: 24, color: 'var(--teal)' }}>✓</div>
            <div style={{ fontSize: 19, fontWeight: 600 }}>Sale captured</div>
            <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 4 }}>
              {done.orig} → {done.up}
              {done.extras.length ? ' · +' + done.extras.length + ' product' + (done.extras.length > 1 ? 's' : '') : ''} · <strong>{money(done.total)}</strong>
            </div>
            <div style={{ display: 'inline-flex', gap: 18, marginTop: 18, padding: '12px 20px', background: 'var(--sunken)', borderRadius: 'var(--r)' }}>
              <Stat k="Upsell ref" v={done.ref} />
              <Stat k="Against" v={done.conf} accent="var(--teal)" />
              <Stat k="Agent" v={done.agent} />
              <Stat k="Status" v="Submitted" accent="var(--teal)" />
            </div>
            <button onClick={reset} style={{ marginTop: 22, width: '100%', padding: '12px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 600 }}>Capture another sale</button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '26px 24px 90px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, alignItems: 'start' }}>
        {/* FORM */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>Capture a sale</div>
            <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2 }}>Enter the booking and what was sold. Prices default in — adjust if needed.</div>
          </div>

          {!me && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 'var(--r)', padding: '11px 14px', fontSize: 12.5, color: '#92400E' }}>
              Your login isn't linked to an agent profile yet, so sales can't be captured. Ask your hotel administrator to add you as an agent.
            </div>
          )}

          {groups.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Today’s captures · {groups.length}</div>
              {groups.slice(0, 5).map((g) => (
                <div key={g.conf} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line)' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 600 }}>{g.conf}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--gray)' }}>{g.lines.map((l) => l.product).join(' · ')}</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600, marginLeft: 'auto' }}>{money(g.total)}</span>
                  <button onClick={() => setViewSale(g)} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--line2)', background: '#fff', color: 'var(--ink)' }}>View</button>
                </div>
              ))}
            </div>
          )}

          {drafts.length > 0 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--r)', padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>Parked drafts · {drafts.length}</div>
              {drafts.map((d) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid #FDE68A' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>{d.conf}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--gray)' }}>{d.orig && d.up ? d.orig + ' → ' + d.up : 'incomplete'}{d.extras && d.extras.length ? ' · +' + d.extras.length : ''}</span>
                  <span style={{ fontSize: 11, color: 'var(--faint)' }}>{d.when}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button onClick={() => resumeDraft(d)} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 5, border: 'none', background: 'var(--teal)', color: '#fff', fontWeight: 600 }}>Resume</button>
                    <button onClick={() => discardDraft(d.id)} style={{ fontSize: 11.5, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--line2)', background: '#fff', color: 'var(--gray)' }}>Discard</button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Confirmation + agent */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Confirmation number <span style={{ color: 'var(--faint)', fontWeight: 400 }}>· sale key</span></label>
                <input className="mono" value={conf} onChange={(e) => setConf(e.target.value)} placeholder="CN-XXXXX" style={{ ...inp, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }} />
              </div>
              <div>
                <label style={lbl}>Agent <span style={{ color: 'var(--faint)', fontWeight: 400 }}>· signed in</span></label>
                <input className="mono" value={me ? me.agent_code + ' · ' + me.name : '—'} readOnly style={{ ...inp, background: 'var(--sunken)', color: 'var(--gray)', fontWeight: 600 }} />
              </div>
            </div>
          </div>

          {/* Room upgrade */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Room upgrade</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Original room</label>
                <select value={orig} onChange={(e) => pickOrig(e.target.value)} style={inp}>
                  <option value="">Select…</option>
                  {ROOMS.map((r) => <option key={r.type} value={r.type}>{r.type}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Rate / night</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, ...inp, padding: '9px 10px' }}>
                  <span style={{ color: 'var(--faint)' }}>$</span>
                  <input className="mono" type="number" step="5" value={origRate} onChange={(e) => setOrigRate(Math.max(0, parseInt(e.target.value || '0', 10)))} style={{ width: '100%', border: 'none', outline: 'none', fontWeight: 600 }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
              <div>
                <label style={lbl}>Upgrade to</label>
                <select value={up} onChange={(e) => pickUp(e.target.value)} style={{ ...inp, borderColor: up && up === orig ? '#DC2626' : 'var(--line2)' }}>
                  <option value="">Select…</option>
                  {ROOMS.map((r) => <option key={r.type} value={r.type}>{r.type}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Rate / night</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, ...inp, padding: '9px 10px' }}>
                  <span style={{ color: 'var(--faint)' }}>$</span>
                  <input className="mono" type="number" step="5" value={upRate} onChange={(e) => setUpRate(Math.max(0, parseInt(e.target.value || '0', 10)))} style={{ width: '100%', border: 'none', outline: 'none', fontWeight: 600 }} />
                </div>
              </div>
            </div>
            {up && up === orig && <div style={{ fontSize: 11.5, color: '#DC2626', marginTop: 8 }}>Upgrade must differ from the original room.</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--gray)' }}>
                Nights
                <input className="mono" type="number" min="1" value={nights} onChange={(e) => setNights(Math.max(1, parseInt(e.target.value || '1', 10)))} style={{ width: 56, fontSize: 13, fontWeight: 600, border: '1px solid var(--line2)', borderRadius: 4, padding: '4px 6px', textAlign: 'center' }} />
              </label>
              <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--gray)' }}>Upgrade delta</span>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--teal)' }}>+${perNight}<span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 400 }}>/n</span></span>
            </div>
          </div>

          {/* Other revenue */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: extras.length ? 12 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Other revenue <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· optional</span></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PRODUCTS.map((p) => (
                  <button key={p.id} onClick={() => addExtra(p.id)} disabled={extras.some((e) => e.id === p.id)}
                    style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--line2)', background: extras.some((e) => e.id === p.id) ? 'var(--sunken)' : '#fff', color: extras.some((e) => e.id === p.id) ? 'var(--faint)' : 'var(--teal)', fontWeight: 500 }}>
                    + {p.name}
                  </button>
                ))}
                <button onClick={addCustom} style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 20, border: '1px dashed var(--line2)', background: '#fff', color: 'var(--gray)', fontWeight: 500 }}>+ Custom</button>
              </div>
            </div>
            {extras.map((e) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--line)' }}>
                {e.custom
                  ? <input value={e.name} onChange={(ev) => setExtraName(e.id, ev.target.value)} placeholder="Product name…" autoFocus style={{ flex: 1, fontSize: 13, fontWeight: 500, border: '1px solid ' + (e.name.trim() ? 'var(--line2)' : '#DC2626'), borderRadius: 4, padding: '5px 8px', outline: 'none' }} />
                  : <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{e.name}</span>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ color: 'var(--faint)' }}>$</span>
                  <input className="mono" type="number" step="5" value={e.price} onChange={(ev) => setExtraPrice(e.id, ev.target.value)} style={{ width: 60, fontSize: 13, fontWeight: 600, border: '1px solid var(--line2)', borderRadius: 4, padding: '4px 6px', textAlign: 'right' }} />
                </div>
                <button onClick={() => removeExtra(e.id)} style={{ fontSize: 11.5, color: 'var(--gray)', background: 'none', border: 'none' }}>Remove</button>
              </div>
            ))}
          </div>
        </div>

        {/* SUMMARY (sticky) */}
        <div style={{ position: 'sticky', top: 22 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--teal-line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', background: 'var(--teal-bg)', borderBottom: '1px solid var(--teal-line)', fontSize: 13, fontWeight: 600 }}>Sale summary</div>
            <div style={{ padding: '14px 16px' }}>
              <Row k="Confirmation" v={conf.trim() ? <span className="mono" style={{ color: 'var(--teal)' }}>{conf.trim().toUpperCase()}</span> : <span style={{ color: 'var(--faint)' }}>—</span>} />
              <Row k="Agent" v={me ? <span className="mono">{me.agent_code}</span> : <span style={{ color: 'var(--faint)' }}>—</span>} />
              <Row k="Upgrade" v={orig && up ? orig + ' → ' + up : <span style={{ color: 'var(--faint)' }}>—</span>} />
              <Row k={'Room · ' + perNight + '/n × ' + nights} v={money(roomTotal)} />
              {extras.map((e) => <Row key={e.id} k={e.name} v={money(e.price)} />)}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 2px', marginTop: 6, borderTop: '1px solid var(--line)', fontSize: 15 }}>
                <span style={{ fontWeight: 600 }}>Sale total</span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--teal)' }}>{money(total)}</span>
              </div>
              <button onClick={() => valid && setConfirmOpen(true)} disabled={!valid}
                style={{ marginTop: 14, width: '100%', padding: '12px', background: valid ? 'var(--teal)' : 'var(--line2)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 600, cursor: valid ? 'pointer' : 'not-allowed' }}>
                Submit sale{valid ? ' · ' + money(total) : ''}
              </button>
              <button onClick={saveDraft} disabled={!dirty}
                style={{ marginTop: 8, width: '100%', padding: '10px', background: '#fff', color: dirty ? 'var(--ink)' : 'var(--faint)', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 500, cursor: dirty ? 'pointer' : 'not-allowed' }}>
                Save as draft
              </button>
              <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 9, textAlign: 'center' }}>Captured against the confirmation # · reconciles with IN-Gauge</div>
            </div>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div onClick={() => !busy && setConfirmOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, background: '#fff', borderRadius: 'var(--r)', boxShadow: '0 16px 48px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Confirm this sale</div>
              <div style={{ fontSize: 12.5, color: 'var(--gray)', marginTop: 2 }}>Captured against <span className="mono" style={{ color: 'var(--teal)' }}>{conf.trim().toUpperCase()}</span> · booked to PMS / IN-Gauge.</div>
            </div>
            <div style={{ padding: '8px 20px' }}>
              {dup && <div style={{ display: 'flex', gap: 8, padding: '9px 11px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--r-sm)', fontSize: 11.5, color: '#991B1B', marginBottom: 10, marginTop: 4 }}>⚠ <span><strong>Possible duplicate</strong> — {conf.trim().toUpperCase()} already has a captured sale today. Capture again only if this is a separate product.</span></div>}
              {oversold && <div style={{ display: 'flex', gap: 8, padding: '9px 11px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 'var(--r-sm)', fontSize: 11.5, color: '#92400E', marginBottom: 10, marginTop: dup ? 0 : 4 }}>⚠ <span><strong>Oversell risk</strong> — {up} shows {upAvail} available and {soldSame} already captured today. Confirm inventory before proceeding.</span></div>}
              <Row k="Agent" v={<span className="mono">{me?.agent_code}</span>} />
              <Row k="Upgrade" v={orig + ' → ' + up} />
              <Row k={'Room · $' + perNight + '/n × ' + nights} v={money(roomTotal)} />
              {extras.map((e) => <Row key={e.id} k={e.name || '(unnamed)'} v={money(e.price)} />)}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px', fontSize: 16 }}>
                <span style={{ fontWeight: 600 }}>Guest pays</span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--teal)' }}>{money(total)}</span>
              </div>
              {submitError && <div style={{ fontSize: 12, color: '#991B1B', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--r-sm)', padding: '8px 10px', marginBottom: 8 }}>{submitError}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid var(--line)' }}>
              <button onClick={() => setConfirmOpen(false)} disabled={busy} style={{ flex: '0 0 auto', padding: '11px 18px', background: '#fff', border: '1px solid var(--line2)', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 500 }}>Back</button>
              <button onClick={doCapture} disabled={busy} style={{ flex: 1, padding: '11px', background: busy ? 'var(--line2)' : 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 600 }}>{busy ? 'Capturing…' : '✓ Confirm & capture · ' + money(total)}</button>
            </div>
          </div>
        </div>
      )}

      {viewSale && (
        <div onClick={() => setViewSale(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, background: '#fff', borderRadius: 'var(--r)', boxShadow: '0 16px 48px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Captured sale</div>
                <div style={{ fontSize: 12.5, color: 'var(--gray)', marginTop: 2 }}><span className="mono" style={{ color: 'var(--teal)' }}>{viewSale.conf}</span> · {viewSale.agent}</div>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-bg)', padding: '3px 9px', borderRadius: 10 }}>Submitted</span>
            </div>
            <div style={{ padding: '8px 20px' }}>
              {viewSale.lines.map((l) => <Row key={l.id} k={l.product + (l.type === 'Room' ? ' · $' + l.unit + '/n × ' + l.qty : '')} v={money(l.amount)} />)}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px', fontSize: 16 }}>
                <span style={{ fontWeight: 600 }}>Total</span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--teal)' }}>{money(viewSale.total)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid var(--line)' }}>
              <button onClick={() => voidGroup(viewSale)} style={{ flex: '0 0 auto', padding: '11px 16px', background: '#fff', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 600 }}>Void sale</button>
              <button onClick={() => setViewSale(null)} style={{ flex: 1, padding: '11px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 14, fontWeight: 600 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <Toast>{toast}</Toast>
    </Shell>
  );
}
