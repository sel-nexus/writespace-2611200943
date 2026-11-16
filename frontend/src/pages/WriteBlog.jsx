/** Publish and revise plain text without persisting drafts or trusting cached access. */
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { readPosts, readSession, POSTS_KEY, SESSION_KEY } from '../utils/storage.js';
import { canManagePost, createPost, updatePost } from '../utils/posts.js';

const control = 'inline-flex min-h-11 items-center rounded-control border border-border px-5 py-3 text-sm hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-600 dark:hover:bg-slate-700 dark:focus-visible:ring-indigo-300';
const input = 'mt-2 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-3 focus:outline-none focus:ring-2 focus:ring-ring dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-300';

/** Remount the draft only when navigation selects a different target. */
export default function WriteBlog() {
  const { id } = useParams();
  return <Editor key={id ?? 'new-post'} id={id} />;
}

/**
 * Keep draft text separate from refreshed storage and authorization snapshots.
 * Args:
 *   id: Select an existing post, or omit to create writing.
 * Returns:
 *   An accessible editor or a safe direct-entry recovery state.
 */
function Editor({ id }) {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(() => ({ posts: readPosts(), session: readSession().value }));
  const post = snapshot.posts.ok ? snapshot.posts.value.find((row) => row.id === id) : null;
  const permitted = canManagePost(post, snapshot.session);
  const [opened, setOpened] = useState(() => !id || permitted);
  const [form, setForm] = useState(() => id && permitted
    ? { title: post.title, content: post.content } : { title: '', content: '' });
  const [result, setResult] = useState(null);
  useEffect(() => {
    document.title = `${id ? 'Edit Blog' : 'Write a Blog'} — WriteSpace browser-local demo`;
    /** Re-read affected boundaries; event payloads never replace draft input. */
    function onStorage(event) {
      if (![POSTS_KEY, SESSION_KEY, null].includes(event.key)) return;
      setSnapshot((previous) => ({
        posts: event.key === POSTS_KEY || event.key === null ? readPosts() : previous.posts,
        session: event.key === SESSION_KEY || event.key === null ? readSession().value : previous.session,
      }));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [id]);
  useEffect(() => {
    // Prefill once after initial read recovery, never after the user starts editing.
    if (!opened && permitted) {
      setForm({ title: post.title, content: post.content });
      setOpened(true);
    }
  }, [opened, permitted, post]);

  /** Validate and recheck session, target and ownership through the shared mutation. */
  function submit(event) {
    event.preventDefault();
    const outcome = id ? updatePost(id, form) : createPost(form);
    setResult(outcome);
    if (outcome.ok) navigate('/blog/' + encodeURIComponent(outcome.value.id));
  }

  if (id && !opened && post && !permitted) return <Navigate to="/blogs" replace />;
  let warning = '';
  if (!snapshot.posts.ok) {
    warning = snapshot.posts.status === 'corrupt'
      ? 'Saved posts are corrupt and cannot be read. No changes were made.'
      : 'Browser storage cannot be read. No changes were made.';
  } else if (id && !post) warning = 'Post not found. No changes were made.';
  else if (!snapshot.session) warning = 'Please log in again before changing posts.';
  else if (id && !permitted) warning = 'Only the author or an administrator can change this post.';

  return (
    <section aria-labelledby="write-title" className="mx-auto max-w-reading py-section dark:bg-slate-900 dark:text-slate-100">
      <h1 id="write-title" className="font-editorial text-headline">
        {id && !opened ? (snapshot.posts.ok ? 'Post not found' : 'Posts unavailable') : id ? 'Edit Blog' : 'Write a Blog'}
      </h1>
      <p className="mt-4 text-foreground-muted dark:text-slate-300">
        Plain text, saved in this browser only. Keep a separate copy. Other tabs can overwrite saved changes; unsaved text here is not refreshed.
      </p>
      {warning && (
        <div role="alert" className="mt-6 space-y-3 text-error-foreground dark:text-red-300">
          <p>{warning}</p>
          {!snapshot.posts.ok && (
            <p>Check site storage access or restore a saved copy. Clearing site data loses writing.</p>
          )}
          <Link to="/blogs" className={control}>
            Back to blogs
          </Link>
        </div>
      )}
      {opened && (
        <form noValidate onSubmit={submit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium">
              Title
            </label>
            <input id="title" name="title" required aria-required="true" value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              aria-invalid={Boolean(result?.errors?.title)}
              aria-describedby={result?.errors?.title ? 'title-error' : undefined}
              className={input} />
            {result?.errors?.title && (
              <p id="title-error" role="alert" className="mt-2 text-sm text-error-foreground dark:text-red-300">
                {result.errors.title}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="content" className="block text-sm font-medium">
              Content
            </label>
            <textarea id="content" name="content" required aria-required="true" value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              aria-invalid={Boolean(result?.errors?.content)}
              aria-describedby={result?.errors?.content ? 'content-error content-count' : 'content-count'}
              className={input + ' min-h-64 resize-y text-reading'} />
            {result?.errors?.content && (
              <p id="content-error" role="alert" className="mt-2 text-sm text-error-foreground dark:text-red-300">
                {result.errors.content}
              </p>
            )}
            <p id="content-count" role="status" aria-live="polite" aria-atomic="true" className="mt-2 text-sm tabular-nums text-foreground-muted dark:text-slate-300">
              {form.content.length} characters
            </p>
          </div>
          {result && !result.ok && !result.errors && (
            <p role="alert" className="text-error-foreground dark:text-red-300">
              {result.message} Your unsaved text is still available.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className={'min-h-11 rounded-control bg-primary-700 px-5 py-3 font-medium text-white hover:bg-primary-800 ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-indigo-700 dark:hover:bg-indigo-600 dark:focus-visible:ring-indigo-300 dark:focus-visible:ring-offset-slate-900'}
            >
              {id ? 'Save Changes' : 'Publish Blog'}
            </button>
            <Link to={id && snapshot.posts.ok && post ? '/blog/' + encodeURIComponent(id) : '/blogs'} className={control}>
              Cancel
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}

Editor.propTypes = { id: PropTypes.string };
