import { useState } from 'react';
import { TopBar, PropertyChip } from '../components/TopBar.jsx';
import { Toggle } from '../components/ui.jsx';
import { INIT_TAXES, INIT_FEES } from '../data/catalog.js';
import { money2 } from '../lib/format.js';

export default function OtherRevenue() {
  const [taxes, setTaxes] = useState(INIT_TAXES);
  const [fees, setFees] = useState(INIT_FEES);
  const [editTax, setEditTax] = useState(null);
  const [editPrice, setEditPrice] = useState(null);
  const [nights, setNights] = useState(3);
  const [roomNet, setRoomNet] = useState(50); // upsell sale/night used in the worked example

  const addProduct = () => setTaxes((ts) => [...ts, { id: 'p' + Date.now(), cat: 'New product', rate: 12.0, mode: 'exclusive', price: 0, core: false }]);
  const removeProduct = (id) => setTaxes((ts) => ts.filter((t) => t.id !== id));
  const setPrice = (id, val) => setTaxes((ts) => ts.map((t) => (t.id === id ? { ...t, price: Math.max(0, Math.round((parseInt(val, 10) || 0) / 5) * 5) } : t)));

  const setRate = (id, val) => setTaxes((ts) => ts.map((t) => (t.id === id ? { ...t, rate: Math.max(0, parseFloat(val) || 0) } : t)));
  const setMode = (id, m) => setTaxes((ts) => ts.map((t) => (t.id === id ? { ...t, mode: m } : t)));
  const toggleFee = (id) => setFees((fs) => fs.map((f) => (f.id === id ? { ...f, on: !f.on } : f)));

  // Worked example: an upsell room sale of $roomNet/night × nights.
  const roomTax = taxes.find((t) => t.id === 'room');
  const sub = roomNet * nights;
  const svc = fees.find((f) => f.id === 'service');
  const feeAmt = svc.on ? +(sub * svc.amount / 100).toFixed(2) : 0;
  const taxBase = sub + (svc.on && svc.taxable ? feeAmt : 0);
  const tax = roomTax.mode === 'exclusive' ? +(taxBase * roomTax.rate / 100).toFixed(2) : 0;
  const total = +(sub + feeAmt + tax).toFixed(2);

  return (
    <div>
      <TopBar title="Other Revenue" kicker="Sell · products &amp; tax" right={<PropertyChip>Grand Horizon</PropertyChip>} />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 24px 80px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }}>
        {/* LEFT — config */}
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>Revenue products &amp; tax</div>
          <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2, marginBottom: 18 }}>Room upgrades plus other revenue an agent can sell. Tax is set per product and applied at the moment of sale.</div>

          {/* Taxes */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Revenue products</span>
              <button onClick={addProduct} style={{ fontSize: 11.5, color: 'var(--teal)', background: 'none', border: 'none' }}>+ Add other revenue</button>
            </div>
            <table>
              <thead><tr style={{ background: 'var(--sunken)' }}>
                {['Product', 'Price', 'Tax', 'Applied', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: i === 1 || i === 2 ? 'right' : 'left', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', padding: '9px 14px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {taxes.map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, fontSize: 13 }}>{t.cat}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      {t.price === null ? (
                        <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>per upgrade</span>
                      ) : editPrice === t.id ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>$
                          <input className="mono" type="number" step="5" defaultValue={t.price} autoFocus
                            onBlur={(e) => { setPrice(t.id, e.target.value); setEditPrice(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            style={{ width: 54, fontSize: 13, fontWeight: 600, border: '1px solid var(--teal)', borderRadius: 4, padding: '3px 5px', textAlign: 'right' }} />
                        </span>
                      ) : (
                        <button onClick={() => setEditPrice(t.id)} className="mono" style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderBottom: '1px dashed var(--line2)', padding: 0 }}>${t.price}</button>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      {editTax === t.id ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <input className="mono" type="number" step="0.5" defaultValue={t.rate} autoFocus
                            onBlur={(e) => { setRate(t.id, e.target.value); setEditTax(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            style={{ width: 54, fontSize: 13, fontWeight: 600, border: '1px solid var(--teal)', borderRadius: 4, padding: '3px 5px', textAlign: 'right' }} />%
                        </span>
                      ) : (
                        <button onClick={() => setEditTax(t.id)} className="mono" style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderBottom: '1px dashed var(--line2)', padding: 0 }}>{t.rate.toFixed(1)}%</button>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <select className="bm-sel" value={t.mode} onChange={(e) => setMode(t.id, e.target.value)}>
                        <option value="exclusive">Exclusive</option>
                        <option value="inclusive">Inclusive</option>
                      </select>
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      {!t.core && <button onClick={() => removeProduct(t.id)} style={{ fontSize: 11.5, color: 'var(--gray)', background: 'none', border: 'none' }}>Remove</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--faint)' }}>
              Room upgrade is priced per upgrade (from Rooms &amp; Rates). <strong>Early arrival</strong> and <strong>late checkout</strong> are default products · <strong>Exclusive</strong> adds tax on top, <strong>Inclusive</strong> is already in the price.
            </div>
          </div>

          {/* Fees */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden', marginTop: 16 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Property fees</span>
              <button style={{ fontSize: 11.5, color: 'var(--teal)', background: 'none', border: 'none' }}>+ Add fee</button>
            </div>
            {fees.map((f) => (
              <div key={f.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Toggle on={f.on} onClick={() => toggleFee(f.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--gray)', marginTop: 2 }}>{f.basis} · {f.taxable ? 'taxable' : 'not taxed'}</div>
                </div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: f.on ? 'var(--ink)' : 'var(--faint)' }}>{f.basis === '% of sale' ? f.amount + '%' : '$' + f.amount}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', background: 'var(--blue-bg)', border: '1px solid #C7D6F5', borderRadius: 'var(--r)', fontSize: 12, marginTop: 16, color: 'var(--gray)' }}>
            <span style={{ color: 'var(--blue)' }}>◆</span><span>These rules apply to every direct sale in <strong>Capture Sale</strong> and post to the matching revenue account on reconciliation.</span>
          </div>
        </div>

        {/* RIGHT — worked example (sticky) */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--teal-line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', background: 'var(--teal-bg)', borderBottom: '1px solid var(--teal-line)' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Worked example</div>
              <div style={{ fontSize: 11.5, color: 'var(--gray)', marginTop: 2 }}>How a room upsell bills with these rules</div>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Upsell / night</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, border: '1px solid var(--line2)', borderRadius: 5, padding: '5px 8px' }}>
                    <span style={{ color: 'var(--faint)' }}>$</span>
                    <input className="mono" type="number" step="5" value={roomNet} onChange={(e) => setRoomNet(Math.max(0, parseInt(e.target.value || '0', 10)))} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600 }} />
                  </div>
                </label>
                <label style={{ width: 78, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Nights</span>
                  <input className="mono" type="number" min="1" value={nights} onChange={(e) => setNights(Math.max(1, parseInt(e.target.value || '1', 10)))} style={{ border: '1px solid var(--line2)', borderRadius: 5, padding: '6px 8px', outline: 'none', fontSize: 14, fontWeight: 600 }} />
                </label>
              </div>

              {[
                ['Upsell subtotal', money2(sub), false],
                ...(svc.on ? [['Service fee · ' + svc.amount + '%', money2(feeAmt), false]] : []),
                ['Room tax · ' + roomTax.rate.toFixed(1) + '% ' + roomTax.mode, roomTax.mode === 'exclusive' ? money2(tax) : 'incl.', false],
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5, color: 'var(--gray)' }}>
                  <span>{r[0]}</span><span className="mono" style={{ color: 'var(--ink)' }}>{r[1]}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 2px', fontSize: 15 }}>
                <span style={{ fontWeight: 600 }}>Guest pays</span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--teal)' }}>{money2(total)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>Captured against the confirmation #, posted by category on reconciliation.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
