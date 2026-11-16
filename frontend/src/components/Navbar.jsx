/** Offer activated role navigation and failure-aware logout in a responsive header. */
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { readSession, SESSION_KEY } from '../utils/storage.js';
import { currentRoleHome, logout } from '../utils/auth.js';
import { Avatar } from './Avatar.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import PropTypes from 'prop-types';

const control = 'inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium hover:bg-surface-raised dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
/** Distinguish the current navigation destination using the inherited indigo palette. */
function navClass({ isActive }) {
  return control + (isActive ? ' bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-slate-800 dark:text-indigo-200 dark:hover:bg-slate-700' : '');
}
/** Render public or role-aware links with local menu state and fresh session reads. */
export function Navbar({ theme = 'light', onToggle = () => {} }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const [, refresh] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    setError('');
  }, [location.key]);
  useEffect(() => {
    /** Refresh role navigation only for session changes and storage clears. */
    function onStorage(event) {
      if (event.key === SESSION_KEY || event.key === null) refresh((value) => value + 1);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const session = readSession().value;
  /** Leave identity and menus intact when the browser refuses logout. */
  function signOut() {
    const result = logout();
    if (!result.ok) { setError(result.message); return; }
    setAccountOpen(false);
    setMobileOpen(false);
    refresh((value) => value + 1);
    navigate('/');
  }
  /** Close disclosure controls on keyboard escape without inventing menu semantics. */
  function closeOnEscape(event) {
    if (event.key === 'Escape') { setMobileOpen(false); setAccountOpen(false); }
  }
  return (
    <header className="border-b border-border dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" onKeyDown={closeOnEscape}>
      <nav aria-label="Main navigation" className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-10">
        <Link to="/" className={control + ' font-editorial text-2xl'}>
          WriteSpace
        </Link>
        <button type="button" aria-label="Toggle navigation" aria-expanded={mobileOpen} aria-controls="navigation-links"
          className={control + ' md:hidden'} onClick={() => setMobileOpen(!mobileOpen)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div id="navigation-links" className={(mobileOpen ? 'flex' : 'hidden') + ' w-full flex-col gap-2 md:flex md:w-auto md:flex-row md:items-center'}>
          {session?.role === 'user' ? (
            <Link to={currentRoleHome(session)} className={control}>
              Home
            </Link>
          ) : (
            <NavLink to={session ? currentRoleHome(session) : '/'} end className={navClass}>
              Home
            </NavLink>
          )}
          {session ? (
            <>
              <NavLink to="/blogs" className={navClass}>
                All Blogs
              </NavLink>
              <NavLink to="/write" className={navClass}>
                Write
              </NavLink>
              {session.role === 'admin' && (
                <NavLink to="/users" className={navClass}>
                  Users
                </NavLink>
              )}
              <div className="relative">
                <button type="button" aria-expanded={accountOpen} aria-controls="account-links"
                  className={control} onClick={() => setAccountOpen(!accountOpen)}>
                  <Avatar role={session.role} displayName={session.displayName} />
                  {session.displayName}
                </button>
                {accountOpen && (
                  <div id="account-links" className="absolute right-0 z-10 min-w-48 rounded-control border border-border bg-surface p-2 shadow-overlay dark:border-slate-700 dark:bg-slate-800">
                    <p className="px-3 py-2 text-sm text-foreground-muted dark:text-slate-300">
                      {session.role === 'admin' ? 'Administrator' : 'Writer'}
                    </p>

                    <button type="button" className={control} onClick={signOut}>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                Log in
              </NavLink>
              <NavLink to="/register" className={navClass}>
                Register
              </NavLink>
            </>
          )}
          <ThemeToggle theme={theme} onToggle={onToggle} />
        </div>
      </nav>
      {error && (
        <p role="alert" className="mx-auto max-w-shell px-6 pb-4 text-sm text-error-foreground dark:text-red-300">
          {error}
        </p>
      )}
    </header>
  );
}

Navbar.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']),
  onToggle: PropTypes.func,
};
