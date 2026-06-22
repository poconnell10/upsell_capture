import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { TopBar, PropertyChip } from '../../components/TopBar.jsx';
import { Toast } from '../../components/ui.jsx';
import {
  TIMEZONES, fetchHotelsWithCounts, createHotel, updateHotel, setHotelActive,
} from '../../store/adminStore.js';

const fld = {
  fontSize: 13, padding: '8px 10px', border: '1px solid var(--line2)',
  borderRadius: 'var(--r-sm)', outline: 'none', background: '#fff',
};
const lab = {
  fontSize: 10.5, fontWeight: 600, color: 'var(--gray)', textTransform: 'uppercase',
  letterSpacing: '.04em', display: 'block', marginBottom: 4,
};
const fmtDate = (x) => new Date(x).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export default function AdminHotels() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); clearTimeout(window.__adt); window.__adt = setTimeout(() => setToast(''), 2200); };

  const [name, setName] = useState('');
  const [tz, setTz] = useState('UTC');
  const [adding, setAdding] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTz, setEditTz] = useState('UTC');

  const load = useCallback(() => {
    setLoading(true);
    fetchHotelsWithCounts()
      .then((h) => { setHotels(h); setError(''); })
      .catch((e) => setError(e.message || 'Failed to load hotels'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const addHotel = async () => {
    if (!name.trim() || adding) return;
    setAdding(true);
    try {
      await createHotel({ name, timezone: tz });
      setName(''); setTz('UTC');
      flash('Hotel added');
      load();
    } catch (e) {
      flash(e.message || 'Could not add hotel');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (h) => { setEditId(h.id); setEditName(h.name); setEditTz(h.timezone); };
  const saveEdit = async (id) => {
    try {
      await updateHotel(id, { name: editName.trim(), timezone: editTz });
      setEditId(null);
      flash('Hotel updated');
      load();
    } catch (e) {
      flash(e.message || 'Update failed');
    }
  };
  const toggleActive = async (h) => {
    try {
      await setHotelActive(h.id, !h.active);
      flash(h.active ? 'Hotel deactivated' : 'Hotel reactivated');
      load();
    } catch (e) {
      flash(e.message || 'Update failed');
    }
  };

  return (
    <div>
      <TopBar title="Admin" kicker="Vendor console" right={<PropertyChip>All hotels</PropertyChip>} />

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 24px 80px' }}>
        <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 6 }}>Admin</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>Hotels</div>
        <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 2, marginBottom: 18 }}>Every client hotel · click one to manage its agents.</div>

        {/* Add hotel */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Add a hotel</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={lab}>Hotel name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grand Horizon" style={{ ...fld, width: '100%' }} />
            </div>
            <div style={{ width: 220 }}>
              <span style={lab}>Timezone</span>
              <select value={tz} onChange={(e) => setTz(e.target.value)} style={{ ...fld, width: '100%' }}>
                {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <button onClick={addHotel} disabled={!name.trim() || adding}
              style={{ padding: '9px 16px', background: name.trim() && !adding ? 'var(--teal)' : 'var(--line2)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600, cursor: name.trim() && !adding ? 'pointer' : 'not-allowed' }}>
              {adding ? 'Adding…' : '+ Add hotel'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 12.5, color: '#991B1B', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12 }}>{error}</div>
        )}

        {/* Hotels table */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          <table>
            <thead><tr style={{ background: 'var(--sunken)' }}>
              {['Hotel', 'Timezone', 'Created', 'Agents', 'Status', ''].map((h, i) => (
                <th key={i} style={{ textAlign: i === 3 ? 'right' : 'left', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint)', padding: '9px 14px' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {hotels.map((h) => {
                const editing = editId === h.id;
                return (
                  <tr key={h.id} style={{ borderTop: '1px solid var(--line)', background: h.active ? '#fff' : '#FCFBF7', opacity: h.active ? 1 : 0.7 }}>
                    <td style={{ padding: '11px 14px' }}>
                      {editing
                        ? <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...fld, width: '100%' }} />
                        : <Link to={'/admin/hotels/' + h.id} style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', textDecoration: 'none' }}>{h.name}</Link>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--gray)' }}>
                      {editing
                        ? <select value={editTz} onChange={(e) => setEditTz(e.target.value)} style={{ ...fld, width: '100%' }}>{TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}</select>
                        : <span className="mono">{h.timezone}</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--gray)' }}>{fmtDate(h.created_at)}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12.5, fontWeight: 600 }} className="mono">{h.agentCount}</td>
                    <td style={{ padding: '11px 14px' }}>
                      {h.active
                        ? <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-bg)', padding: '2px 8px', borderRadius: 10 }}>Active</span>
                        : <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--gray)', background: 'var(--sunken)', padding: '2px 8px', borderRadius: 10 }}>Inactive</span>}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {editing ? (
                        <>
                          <button onClick={() => saveEdit(h.id)} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--teal)', background: 'none', border: 'none', marginRight: 10 }}>Save</button>
                          <button onClick={() => setEditId(null)} style={{ fontSize: 11.5, color: 'var(--gray)', background: 'none', border: 'none' }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <Link to={'/admin/hotels/' + h.id} style={{ fontSize: 11.5, color: 'var(--ink)', textDecoration: 'none', marginRight: 12 }}>Agents →</Link>
                          <button onClick={() => startEdit(h)} style={{ fontSize: 11.5, color: 'var(--gray)', background: 'none', border: 'none', marginRight: 10 }}>Edit</button>
                          <button onClick={() => toggleActive(h)} style={{ fontSize: 11.5, color: h.active ? '#DC2626' : 'var(--teal)', background: 'none', border: 'none' }}>{h.active ? 'Deactivate' : 'Activate'}</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {loading && <tr><td colSpan={6} style={{ padding: '28px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>Loading…</td></tr>}
              {!loading && hotels.length === 0 && <tr><td colSpan={6} style={{ padding: '28px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>No hotels yet — add one above.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Toast>{toast}</Toast>
    </div>
  );
}
