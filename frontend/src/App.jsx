/** Compose local authentication routes while preserving the informational demo shell. */
import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { Link, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar.jsx';
import { PublicNavbar } from './components/PublicNavbar.jsx';
import LandingPage from './pages/LandingPage.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import Home from './pages/Home.jsx';
import ReadBlog from './pages/ReadBlog.jsx';

/**
 * Present a route's introduction in the shared editorial reading measure.
 *
 * Args:
 *   title: Identify the current page for readers and assistive technology.
 *   children: Supply the explanation and any route recovery action.
 * Returns:
 *   A labelled section with one primary heading.
 */
function Introduction({ title, children }) {
  /** Keep browser history entries identifiable without touching persisted data. */
  useEffect(() => {
    document.title = `${title} — WriteSpace browser-local demo`;
  }, [title]);

  return (
    <section aria-labelledby="page-title" className="max-w-reading py-section">
      <h1 id="page-title" className="font-editorial text-headline">
        {title}
      </h1>
      <div className="mt-6 space-y-6 text-reading text-foreground-muted">
        {children}
      </div>
    </section>
  );
}

Introduction.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

/** Return a clear unmatched-route explanation and a native home navigation link. */
function NotFound() {
  return (
    <Introduction title="This page isn’t here.">
      <p>
        The address does not match a page in this demo. You can return to the
        home page without changing any local data.
      </p>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center rounded-control bg-primary-700 px-5
          py-2 text-base font-medium text-white hover:bg-primary-800
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 motion-safe:transition-colors motion-safe:duration-quick"
      >
        Return home
      </Link>
    </Introduction>
  );
}

/** Share the demo warning and skip target without duplicating landing chrome. */
function Layout() {
  const landing = useLocation().pathname === '/';
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <a
        href="#main-content"
        className="sr-only rounded-control bg-surface px-4 py-3 text-primary-700
          focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30
          focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      {landing ? <PublicNavbar /> : <Navbar />}
      <main
        id="main-content"
        tabIndex={-1}
        className={landing ? '' : 'mx-auto max-w-shell px-6 pb-section pt-8 sm:px-10'}
      >
        <aside
          role="note"
          aria-labelledby="demo-warning"
          className="mx-auto max-w-reading rounded-control border border-border
            bg-warning-background p-5 text-sm leading-relaxed text-warning-foreground"
        >
          <h2 id="demo-warning" className="font-semibold">
            Browser-local demo — not secure authentication
          </h2>
          <p className="mt-2">
            There is no backend or shared account service. Local data can be
            inspected or changed on this device. Do not use real passwords,
            sensitive information, or your only copy of important writing.
          </p>
        </aside>
        <Outlet />
      </main>
      {!landing && (
        <footer className="border-t border-border">
          <p className="mx-auto max-w-shell px-6 py-6 text-sm text-foreground-muted sm:px-10">
            WriteSpace · Local to your browser. No cross-device synchronization.
          </p>
        </footer>
      )}
    </div>
  );
}

/** Declare guard groups without inventing pages belonging to later feature slices. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route element={<ProtectedRoute guestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/blogs" element={<Home />} />
          <Route path="/blog/:id" element={<ReadBlog />} />
          <Route path="/write" element={<NotFound />} />
          <Route path="/edit/:id" element={<NotFound />} />
        </Route>
        <Route element={<ProtectedRoute adminOnly />}>
          <Route path="/admin" element={<NotFound />} />
          <Route path="/users" element={<NotFound />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
