import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

// Links every agent sees.
const NAV = [
  ['Agent Sales', '/'],
  ['Capture Sale', '/capture'],
  ['Integrations', '/integrations'],
];
// Links only vendor admins see.
const VENDOR_NAV = [
  ['Rooms & Rates', '/rooms'],
  ['Other Revenue', '/other'],
  ['Webhooks', '/admin/webhooks'],
  ['Admin', '/admin'],
  ['Docs', '/admin/docs'],
];

// Shared top bar + primary nav. `right` renders the property / user chip per page.
export function TopBar({ title, kicker, right }) {
  const { isVendor } = useAuth();
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
        U
      </span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
      {kicker && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{kicker}</span>}
      <nav style={{ display: 'flex', gap: 2, marginLeft: 16 }}>
        {[...NAV, ...(isVendor ? VENDOR_NAV : [])].map(([label, to]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === '/admin'}
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
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        {right && (
          <span style={{ fontSize: 11.5, color: 'var(--gray)', display: 'flex', alignItems: 'center', gap: 7 }}>
            {right}
          </span>
        )}
        <AccountChip />
      </div>
    </div>
  );
}

function AccountChip() {
  const { user, agent, isVendor, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const label = agent?.name || user.email;
  const role = isVendor ? 'Vendor' : agent ? agent.agent_code : 'No agent profile';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, alignItems: 'flex-end' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--faint)' }}>{role}</span>
      </span>
      <button
        onClick={async () => { await signOut(); navigate('/login', { replace: true }); }}
        style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 6, border: '1px solid var(--line2)', background: '#fff', color: 'var(--gray)', fontWeight: 500 }}
      >
        Sign out
      </button>
    </span>
  );
}

export const PropertyChip = ({ children }) => (
  <>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }} />
    {children}
  </>
);
