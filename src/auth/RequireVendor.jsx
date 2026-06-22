import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

// Gate the admin panel to vendor admins (emails in vendor_admins). Everyone
// else is redirected: unauthenticated → /login, non-vendor → / (home).
export function RequireVendor({ children }) {
  const { session, isVendor, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--faint)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (!isVendor) return <Navigate to="/" replace />;
  return children;
}
