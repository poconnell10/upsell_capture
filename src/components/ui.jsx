// Small presentational primitives reused across the screens.

export const Row = ({ k, v }) => (
  <div
    style={{
      display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0',
      borderBottom: '1px solid var(--line)', fontSize: 12.5,
    }}
  >
    <span style={{ color: 'var(--gray)' }}>{k}</span>
    <span style={{ fontWeight: 500, textAlign: 'right' }}>{v}</span>
  </div>
);

export const Stat = ({ k, v, accent }) => (
  <div>
    <div
      style={{
        fontSize: 10.5, fontWeight: 600, letterSpacing: '.05em',
        textTransform: 'uppercase', color: 'var(--faint)',
      }}
    >
      {k}
    </div>
    <div
      style={{ fontSize: 14, fontWeight: 600, marginTop: 2, color: accent || 'var(--ink)' }}
      className={k === 'Against' || k === 'Upsell ref' || k === 'Agent' ? 'mono' : ''}
    >
      {v}
    </div>
  </div>
);

export const Seg = ({ opts, val, set }) => (
  <div style={{ display: 'inline-flex', background: 'var(--sunken)', borderRadius: 6, padding: 2, gap: 2 }}>
    {opts.map(([k, l]) => (
      <button
        key={k}
        onClick={() => set(k)}
        style={{
          padding: '5px 12px', border: 'none', borderRadius: 4, fontSize: 12,
          fontWeight: val === k ? 600 : 500,
          background: val === k ? '#fff' : 'transparent',
          color: val === k ? 'var(--ink)' : 'var(--gray)',
          boxShadow: val === k ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
        }}
      >
        {l}
      </button>
    ))}
  </div>
);

export const KPI = ({ k, v, sub, accent }) => (
  <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '13px 15px' }}>
    <div
      style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '.05em',
        textTransform: 'uppercase', color: 'var(--faint)',
      }}
    >
      {k}
    </div>
    <div style={{ fontSize: 24, fontWeight: 600, marginTop: 3, color: accent || 'var(--ink)' }}>{v}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>{sub}</div>}
  </div>
);

export function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 34, height: 19, borderRadius: 20, border: 'none', padding: 2,
        background: on ? 'var(--teal)' : 'var(--line2)', position: 'relative', transition: 'background .15s',
      }}
    >
      <span
        style={{
          display: 'block', width: 15, height: 15, borderRadius: '50%', background: '#fff',
          transform: 'translateX(' + (on ? '15px' : '0') + ')', transition: 'transform .15s',
          boxShadow: '0 1px 2px rgba(0,0,0,.2)',
        }}
      />
    </button>
  );
}

// Centered modal with a click-out backdrop.
export function Modal({ onClose, width = 420, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,20,25,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width, maxHeight: '90vh', overflowY: 'auto', background: '#fff',
          borderRadius: 'var(--r)', boxShadow: '0 16px 48px rgba(0,0,0,.2)', overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Toast({ children, prefix }) {
  if (!children) return null;
  return (
    <div
      style={{
        position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--ink)', color: '#fff', padding: '11px 16px', borderRadius: 'var(--r)',
        fontSize: 13, fontWeight: 500, boxShadow: '0 12px 32px rgba(0,0,0,.2)',
      }}
    >
      {prefix ? prefix + ' ' : ''}
      {children}
    </div>
  );
}
