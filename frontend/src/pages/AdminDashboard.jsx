/** Derive browser-local administration counts and reuse fresh post deletion. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatCard } from '../components/StatCard.jsx';
import { readPosts, readUsers, readSession, POSTS_KEY, USERS_KEY, SESSION_KEY } from '../utils/storage.js';
import { allAccounts } from '../utils/users.js';
import { deletePost } from '../utils/posts.js';
import { newestFirst, formatDate } from '../utils/presentation.js';

const control = 'inline-flex min-h-11 items-center rounded-control border border-border px-5 py-3 text-sm hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring';
/** Show valid zeros separately from unavailable data, with activated management links. */
export default function AdminDashboard() {
  const [posts, setPosts] = useState(readPosts);
  const [users, setUsers] = useState(readUsers);
  const [session, setSession] = useState(() => readSession().value);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Admin Dashboard — WriteSpace browser-local demo';
    /** Refresh only the affected collection or identity, never trust event payloads. */
    function onStorage(event) {
      if (event.key === POSTS_KEY || event.key === null) setPosts(readPosts());
      if (event.key === USERS_KEY || event.key === null) setUsers(readUsers());
      if (event.key === SESSION_KEY || event.key === null) setSession(readSession().value);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const accounts = users.ok ? allAccounts(users.value) : [];
  const recent = posts.ok ? newestFirst(posts.value).slice(0, 5) : [];
  /** Confirm first, then delegate to the shared freshly authorized mutation. */
  function removePost(id) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    const result = deletePost(id);
    if (!result.ok) { setError(result.message); return; }
    setPosts(readPosts());
    navigate('/blogs');
  }
  return (
    <section className="py-section">
      <h1 className="font-editorial text-headline">Admin Dashboard</h1>
      <p className="mt-4 text-foreground-muted">An overview of writing and accounts in this browser.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" value={posts.ok ? posts.value.length : null} />
        <StatCard label="Total Users" value={users.ok ? accounts.length : null} />
        <StatCard label="Total Admins" value={users.ok ? accounts.filter((user) => user.role === 'admin').length : null} />
        <StatCard label="Total Registered Users" value={users.ok ? accounts.filter((user) => user.role === 'user').length : null} />
      </div>
      {!posts.ok && <p role="alert" className="mt-4 text-error-foreground">Posts unavailable: {posts.status}. {posts.message}</p>}
      {!users.ok && <p role="alert" className="mt-4 text-error-foreground">Accounts unavailable: {users.status}. {users.message}</p>}
      {(!posts.ok || !users.ok) && (
        <button type="button" className={control + ' mt-4'} onClick={() => { setPosts(readPosts()); setUsers(readUsers()); }}>Retry loading data</button>
      )}
      <nav aria-label="Quick actions" className="mt-8 flex flex-wrap gap-3">
        <Link to="/write" className={control}>Write New Post</Link>
        <Link to="/users" className={control}>Manage Users</Link>
      </nav>
      <section aria-labelledby="recent-posts" className="mt-12">
        <h2 id="recent-posts" className="font-editorial text-3xl">Recent Posts</h2>
        {posts.ok && recent.length === 0 && <p role="status" className="mt-4 text-foreground-muted">No posts yet.</p>}
        <ul className="mt-6 divide-y divide-border">
          {recent.map((post) => (
            <li key={post.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div className="min-w-0 break-words">
                <Link to={'/blog/' + encodeURIComponent(post.id)} className="text-lg font-medium underline focus-visible:ring-2 focus-visible:ring-ring">{post.title}</Link>
                <p className="mt-2 text-sm text-foreground-muted">{post.authorName} · {formatDate(post.createdAt)}</p>
              </div>
              {session?.role === 'admin' && (
                <div className="flex gap-3">
                  <Link to={'/edit/' + encodeURIComponent(post.id)} aria-label={'Edit ' + post.title} className={control}>Edit</Link>
                  <button type="button" aria-label={'Delete ' + post.title} className={control + ' text-error-foreground'} onClick={() => removePost(post.id)}>Delete</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      {error && <p role="alert" className="mt-4 text-error-foreground">{error}</p>}
      <p className="mt-8 text-sm text-foreground-muted">Other tabs refresh this view. Concurrent changes are not transactional; the last write can overwrite another tab’s changes.</p>
    </section>
  );
}
