/** Read escaped plain text and delete only through explicit confirmed activation. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar.jsx';
import { readPosts, readSession, POSTS_KEY, SESSION_KEY } from '../utils/storage.js';
import { canManagePost, deletePost } from '../utils/posts.js';
import { formatDate } from '../utils/presentation.js';

const control = 'inline-flex min-h-11 items-center rounded-control border border-border px-5 py-3 text-sm hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-600 dark:hover:bg-slate-700 dark:focus-visible:ring-indigo-300';
/** Keep the displayed record on failed deletion and navigate only after a saved write. */
export default function ReadBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState(readPosts);
  const [session, setSession] = useState(() => readSession().value);
  const [error, setError] = useState('');
  useEffect(() => {
    setPosts(readPosts());
    setError('');
    /** Refresh displayed data and visibility on relevant cross-tab changes. */
    function onStorage(event) {
      if (event.key === POSTS_KEY || event.key === null) setPosts(readPosts());
      if (event.key === SESSION_KEY || event.key === null) setSession(readSession().value);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [id]);
  const post = posts.ok ? posts.value.find((row) => row.id === id) : null;
  useEffect(() => {
    document.title = (post?.title ?? (posts.ok ? 'Post not found' : 'Posts unavailable')) + ' — WriteSpace browser-local demo';
  }, [post?.title, posts.ok]);
  /** Ask only on activation; cancellation performs no reads or writes. */
  function removePost() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    const result = deletePost(id);
    if (!result.ok) { setError(result.message); return; }
    setPosts(readPosts());
    navigate('/blogs');
  }
  return (
    <section className="mx-auto max-w-reading py-section dark:bg-slate-900 dark:text-slate-100">
      <Link to="/blogs" className={control}>Back to blogs</Link>
      {!posts.ok ? (
        <div role="alert" className="mt-8 space-y-4 text-error-foreground dark:text-red-300">
          <h1 className="font-editorial text-3xl">Posts unavailable</h1>
          <p>{posts.status === 'corrupt' ? 'Saved posts are corrupt and cannot be read.' : 'Browser storage cannot be read.'} No changes were made.</p>
          <p>Check site storage access or restore a saved copy. Clearing site data loses writing.</p>
          <button type="button" className={control} onClick={() => setPosts(readPosts())}>Retry loading posts</button>
        </div>
      ) : !post ? (
        <h1 className="mt-8 font-editorial text-headline">Post not found</h1>
      ) : (
        <article className="mt-8">
          <h1 className="break-words font-editorial text-headline">{post.title}</h1>
          <div className="mt-6 flex items-center gap-3">
            <Avatar role="user" displayName={post.authorName} />
            <p className="break-words text-sm text-foreground-muted dark:text-slate-300">{post.authorName} · {formatDate(post.createdAt)}</p>
          </div>
          <p aria-label="Post content" className="mt-8 whitespace-pre-wrap break-words text-reading">{post.content}</p>
          {canManagePost(post, session) && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={'/edit/' + encodeURIComponent(post.id)} className={control}>Edit</Link>
              <button type="button" className={control + ' text-error-foreground dark:text-red-300'} onClick={removePost}>Delete</button>
            </div>
          )}
          {error && <p role="alert" className="mt-4 text-error-foreground dark:text-red-300">{error}</p>}
        </article>
      )}
    </section>
  );
}
