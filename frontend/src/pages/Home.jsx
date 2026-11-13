/** Display all readable local posts without initializing or repairing storage. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard.jsx';
import { readPosts, readSession, POSTS_KEY, SESSION_KEY } from '../utils/storage.js';
import { newestFirst } from '../utils/presentation.js';

const control = 'inline-flex min-h-11 items-center rounded-control border border-border px-5 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-surface-raised';
/** Render newest-first writing and refresh relevant snapshots on cross-tab events. */
export default function Home() {
  const [posts, setPosts] = useState(readPosts);
  const [session, setSession] = useState(() => readSession().value);
  useEffect(() => {
    document.title = 'All Blogs — WriteSpace browser-local demo';
    /** Re-read affected keys rather than trusting another tab's payload. */
    function onStorage(event) {
      if (event.key === POSTS_KEY || event.key === null) setPosts(readPosts());
      if (event.key === SESSION_KEY || event.key === null) setSession(readSession().value);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const sorted = posts.ok ? newestFirst(posts.value) : [];
  return (
    <section aria-labelledby="feed-title" className="py-section">
      <h1 id="feed-title" className="font-editorial text-headline">All Blogs</h1>
      <p className="mt-4 text-foreground-muted">Writing saved in this browser, newest first.</p>
      <p className="mt-3 text-sm text-foreground-muted">Keep a separate copy. Concurrent tabs can overwrite each other’s updates.</p>
      {!posts.ok ? (
        <div role="alert" className="mt-8 space-y-4 rounded-control border border-border p-6 text-error-foreground">
          <p>{posts.status === 'corrupt' ? 'Saved posts cannot be read because local data is corrupt.' : 'Posts are unavailable because browser storage cannot be read.'} No changes were made.</p>
          <p>Check browser storage access or restore a saved copy. Clearing site data loses your writing.</p>
          <button type="button" className={control} onClick={() => setPosts(readPosts())}>Retry loading posts</button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="mt-8 space-y-4">
          <p role="status">No posts yet. Make room for your first idea.</p>
          <Link to="/write" className={control}>Write your first post</Link>
        </div>
      ) : (
        <div aria-label="Blog feed" className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((post, index) => <BlogCard key={post.id} post={post} session={session} index={index} />)}
        </div>
      )}
    </section>
  );
}
