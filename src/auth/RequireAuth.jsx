import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

// Gate authenticated routes. Unauthenticated users are sent to /login, with
// the attempted location preserved so we can return there after sign-in.
export function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--faint)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
