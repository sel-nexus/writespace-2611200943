/** Present restrained public navigation with reactive local role identity. */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { readSession, SESSION_KEY } from '../utils/storage.js';
import { currentRoleHome } from '../utils/auth.js';
import { Avatar } from './Avatar.jsx';

const control = 'inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
/** Show guest links or a role-home action without changing storage on render. */
export function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(() => readSession().value);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    setSession(readSession().value);
  }, [location.key]);
  useEffect(() => {
    /** Re-read identity after session changes or a whole-storage clear. */
    function onStorage(event) {
      if (event.key === SESSION_KEY || event.key === null) setSession(readSession().value);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface"
      onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <nav aria-label="Public navigation" className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-10">
        <Link to="/" className={control + ' font-editorial text-2xl'}>
          WriteSpace
        </Link>
        <button type="button" aria-label="Toggle navigation" aria-expanded={open} aria-controls="public-links"
          className={control + ' md:hidden'} onClick={() => setOpen(!open)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div id="public-links" className={(open ? 'flex' : 'hidden') + ' w-full flex-col gap-2 md:flex md:w-auto md:flex-row md:items-center'}>
          {session ? (
            <>
              <span className="flex items-center gap-2 px-3 text-sm">
                <Avatar role={session.role} displayName={session.displayName} />
                {session.displayName}
              </span>
              <Link to={currentRoleHome(session)} className={control}>
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className={control}>
                Login
              </Link>
              <Link to="/register" className={control + ' border border-border'}>
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
