/** Introduce the browser-local writing demo and its newest saved previews. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { readPosts, readSession, POSTS_KEY, SESSION_KEY } from '../utils/storage.js';
import { excerpt, formatDate, newestFirst } from '../utils/presentation.js';

const control = 'inline-flex min-h-11 items-center justify-center rounded-control px-5 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors motion-safe:duration-quick';
const features = [
  { title: 'Write Freely', description: 'A simple space for notes, stories, and ideas. Let your words take the lead.', path: 'M4 20h4L20 8l-4-4L4 16v4ZM13 7l4 4' },
  { title: 'Private & Local', description: 'Writing stays in this browser, not on a server. Local does not mean encrypted or secure.', path: 'M5 4h14v16H5V4Zm4 4h6M9 12h6M9 16h3' },
  { title: 'Instant & Fast', description: 'Read and write without a remote service. Your ideas stay close at hand.', path: 'm13 3-8 11h6l-1 7 9-12h-7l1-6Z' },
];
/** Render previews with honest empty/error states and event-driven refresh. */
export default function LandingPage() {
  const [posts, setPosts] = useState(readPosts);
  const [session, setSession] = useState(() => readSession().value);
  useEffect(() => {
    document.title = 'Your thoughts. Your space. Beautifully simple. — WriteSpace browser-local demo';
    /** Refresh only collections and identity relevant to this public page. */
    function onStorage(event) {
      if (event.key === POSTS_KEY || event.key === null) setPosts(readPosts());
      if (event.key === SESSION_KEY || event.key === null) setSession(readSession().value);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const previews = posts.ok ? newestFirst(posts.value).slice(0, 3) : [];
  return (
    <>
      <section aria-labelledby="landing-title" className="flex min-h-screen items-center bg-gradient-to-br from-surface-raised via-background to-primary-50">
        <div className="mx-auto grid w-full max-w-shell items-center gap-16 px-6 py-section sm:px-10 lg:grid-cols-2">
          <div>
            <p className="mb-6 text-sm font-medium tracking-wide text-foreground-muted">
              A space for your words.
            </p>
            <h1 id="landing-title" className="font-editorial text-headline">
              Your thoughts. Your space. Beautifully simple.
            </h1>
            <p className="mt-6 max-w-reading text-reading text-foreground-muted">
              Welcome to WriteSpace. Make room for the stories and ideas only you can write.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className={control + ' bg-primary-700 text-white hover:bg-primary-800'}>
                Get Started Free
              </Link>
              <Link to={session ? '/blogs' : '/login'} className={control + ' border border-border bg-surface hover:bg-surface-raised'}>
                Start Reading
              </Link>
            </div>
          </div>
          <div aria-label="Writing preview illustration" className="rounded-control border border-border bg-surface p-8 motion-safe:animate-preview-float">
            <p className="text-sm text-foreground-muted">
              A little room to think
            </p>
            <h2 className="mt-6 font-editorial text-3xl">
              Every story starts with a thought.
            </h2>
            <p className="mt-6 text-reading text-foreground-muted">
              A quiet morning. An unfinished idea. A sentence worth keeping. This is your space to begin.
            </p>
            <p className="mt-8 text-xs text-foreground-muted">
              Illustration · not a saved post
            </p>
          </div>
        </div>
      </section>
      <section aria-labelledby="features-title" className="mx-auto max-w-shell px-6 py-section sm:px-10">
        <h2 id="features-title" className="font-editorial text-3xl">
          Less in the way. More on the page.
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-control border border-border p-6">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
                <path d={feature.path} />
              </svg>
              <h3 className="mt-6 font-editorial text-2xl">
                {feature.title}
              </h3>
              <p className="mt-4 leading-relaxed text-foreground-muted">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-8 max-w-reading leading-relaxed text-foreground-muted">
          Browser-local data belongs to this browser and this site address. It does not synchronize across devices, and clearing site data can remove it. Keep a separate copy of writing you want to preserve. Concurrent tabs can overwrite each other’s updates.
        </p>
      </section>
      <section aria-labelledby="recent-title" className="mx-auto max-w-shell px-6 pb-section sm:px-10">
        <h2 id="recent-title" className="font-editorial text-3xl">
          Recent writing
        </h2>
        <p className="mt-3 text-foreground-muted">
          The newest posts saved in this browser.
        </p>
        {!posts.ok ? (
          <div role="alert" className="mt-8 rounded-control border border-border p-6 text-error-foreground">
            <p>
              {posts.status === 'corrupt' ? 'Saved posts cannot be read because local data is corrupt.' : 'Posts are unavailable because browser storage cannot be read.'} No changes were made.
            </p>
            <p className="mt-3">
              Check browser storage access or restore a saved copy. Do not clear site data unless you intend to lose it.
            </p>
            <button type="button" className={control + ' mt-4 border border-border text-foreground hover:bg-surface-raised'} onClick={() =>
               setPosts(readPosts())}>Retry loading posts
            </button>
          </div>
        ) : previews.length === 0 ? (
          <p role="status" className="mt-8 text-foreground-muted">
            No posts yet — check back soon!
          </p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {previews.map((post) => (
              <article key={post.id} className="min-w-0 rounded-control border border-border p-6">
                <h3 className="break-words font-editorial text-2xl">
                  <Link to={'/blog/' + encodeURIComponent(post.id)} className="rounded-control hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {post.title}
                  </Link>
                </h3>
                <p className="mt-4 break-words leading-relaxed text-foreground-muted">
                  {excerpt(post.content)}
                </p>
                <p className="mt-6 break-words text-sm text-foreground-muted">
                  {post.authorName} · {formatDate(post.createdAt)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-shell flex-col justify-between gap-4 px-6 py-8 text-sm text-foreground-muted sm:px-10 md:flex-row">
          <p>
            © {new Date().getFullYear()} WriteSpace · Local to your browser. No cross-device synchronization.
          </p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-2">
            <Link to="/" className={control}>
              Home
            </Link>
            <Link to="/blogs" className={control}>
              All Blogs
            </Link>
            <Link to="/login" className={control}>
              Login
            </Link>
            <Link to="/register" className={control}>
              Register
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
