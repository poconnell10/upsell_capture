import { NavLink } from 'react-router-dom';

const NAV = [
  ['Agent Sales', '/'],
  ['Capture Sale', '/capture'],
  ['Rooms & Rates', '/rooms'],
  ['Other Revenue', '/other'],
];

// Shared top bar + primary nav. `right` renders the property / user chip per page.
export function TopBar({ title, kicker, right }) {
  return (
    <div
      style={{
        height: 54,
        background: '#fff',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 22px',
      }}
    >
      <span
        style={{
          width: 26, height: 26, borderRadius: 6, background: 'var(--teal)', color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700,
        }}
      >
        B
      </span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
      {kicker && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{kicker}</span>}
      <nav style={{ display: 'flex', gap: 2, marginLeft: 16 }}>
        {NAV.map(([label, to]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              fontSize: 12,
              textDecoration: 'none',
              padding: '5px 11px',
              borderRadius: 6,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--teal)' : 'var(--gray)',
              background: isActive ? 'var(--teal-bg)' : 'transparent',
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {right && (
        <span
          style={{
            marginLeft: 'auto', fontSize: 11.5, color: 'var(--gray)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          {right}
        </span>
      )}
    </div>
  );
}

export const PropertyChip = ({ children }) => (
  <>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }} />
    {children}
  </>
);
