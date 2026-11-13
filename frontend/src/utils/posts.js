/** Mutate local posts using fresh, fail-closed authorization and persistence reads. */
import { readPosts, readSession, writePosts } from './storage.js';

/**
 * Decide display eligibility only; mutations never trust a caller's cached identity.
 * Args:
 *   post: Supply the displayed author snapshot.
 *   session: Supply the current display identity.
 * Returns:
 *   Whether owner or administrator controls should be visible.
 */
export function canManagePost(post, session) {
  return Boolean(post && session && (session.role === 'admin'
    || (session.role === 'user' && session.userId === post.authorId)));
}
/** Read both boundaries for every action, including actions that will be denied. */
function fresh() {
  const session = readSession();
  const posts = readPosts();
  if (!session.ok) return session;
  if (!session.value) return { ok: false, code: 'AUTH_REQUIRED', message: 'Please log in again before changing posts.' };
  if (!posts.ok) return posts;
  return { ok: true, session: session.value, posts: posts.value };
}
/** Collect both required plain-text field errors without altering entered whitespace. */
function validate(input) {
  const errors = {};
  for (const field of ['title', 'content']) {
    if (typeof input?.[field] !== 'string' || !input[field].trim()) errors[field] = 'This field is required.';
  }
  return Object.keys(errors).length
    ? { ok: false, code: 'VALIDATION_FAILED', message: 'Please correct the marked fields.', errors }
    : { ok: true };
}
/** Resolve a fresh target and reject missing records or changed ownership. */
function target(state, id) {
  const post = state.posts.find((row) => row.id === id);
  if (!post) return { ok: false, code: 'POST_NOT_FOUND', message: 'Post not found. No changes were made.' };
  if (!canManagePost(post, state.session)) return { ok: false, code: 'FORBIDDEN', message: 'Only the author or an administrator can change this post.' };
  return { ok: true, value: post };
}
/**
 * Append writing with identity from a fresh session, returning it only after saving.
 * Args:
 *   input: Supply required title and plain-text content; extra fields are ignored.
 * Returns:
 *   The saved post or an explicit failure without writes on unsafe reads.
 */
export function createPost(input) {
  const state = fresh();
  if (!state.ok) return state;
  const checked = validate(input);
  if (!checked.ok) return checked;
  let post;
  try {
    post = { id: crypto.randomUUID(), title: input.title, content: input.content,
      createdAt: new Date().toISOString(), authorId: state.session.userId, authorName: state.session.displayName };
  } catch {
    return { ok: false, code: 'IDENTITY_FAILED', message: 'Could not create a local post identity. Your form is still available.' };
  }
  const saved = writePosts([...state.posts, post]);
  return saved.ok ? { ok: true, value: post } : saved;
}
/**
 * Replace only title and content on an authorized fresh record.
 * Args:
 *   id: Identify the saved post.
 *   input: Supply both required plain-text fields.
 * Returns:
 *   The saved post with original identity, author and timestamp, or a failure.
 */
export function updatePost(id, input) {
  const state = fresh();
  if (!state.ok) return state;
  const found = target(state, id);
  if (!found.ok) return found;
  const checked = validate(input);
  if (!checked.ok) return checked;
  const post = { ...found.value, title: input.title, content: input.content };
  const saved = writePosts(state.posts.map((row) => row.id === id ? post : row));
  return saved.ok ? { ok: true, value: post } : saved;
}
/**
 * Delete one freshly authorized record; confirmation belongs to the activated UI.
 * Args:
 *   id: Identify the target. Any passed session is intentionally ignored.
 * Returns:
 *   Success only after persistence, or a failure preserving saved state.
 */
export function deletePost(id) {
  const state = fresh();
  if (!state.ok) return state;
  const found = target(state, id);
  if (!found.ok) return found;
  const saved = writePosts(state.posts.filter((row) => row.id !== id));
  return saved.ok ? { ok: true } : saved;
}
