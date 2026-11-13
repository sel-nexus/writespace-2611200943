/** Resolve local route access from fresh, validated browser session reads. */
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { readSession, SESSION_KEY } from '../utils/storage.js';
import { currentRoleHome } from '../utils/auth.js';

/**
 * Deny invalid sessions and refresh access on navigation or relevant storage events.
 * Args:
 *   children: Optionally supply guarded content instead of an Outlet.
 *   adminOnly: Require the administrator role.
 *   guestOnly: Redirect signed-in identities to role home.
 * Returns:
 *   Permitted content or a replacing redirect; never writes storage.
 */
export function ProtectedRoute({ children, adminOnly = false, guestOnly = false }) {
  const location = useLocation();
  const [, refresh] = useState(0);
  useEffect(() => {
    /** Re-read rather than trust another tab's event payload. */
    function onStorage(event) {
      if (event.key === SESSION_KEY || event.key === null) refresh((value) => value + 1);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [location.key]);
  const session = readSession().value;
  if (guestOnly) return session ? <Navigate to={currentRoleHome(session)} replace /> : (children ?? <Outlet />);
  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children ?? <Outlet />;
}
ProtectedRoute.propTypes = {
  children: PropTypes.node,
  adminOnly: PropTypes.bool,
  guestOnly: PropTypes.bool,
};
