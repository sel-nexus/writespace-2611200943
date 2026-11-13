/** Preserve browser records and return explicit, fail-closed persistence outcomes. */
export const POSTS_KEY = 'writespace_posts';
export const USERS_KEY = 'writespace_users';
export const SESSION_KEY = 'writespace_session';

/** Check complete required string fields without normalizing persisted text. */
function strings(record, fields) {
  return record !== null && typeof record === 'object' && !Array.isArray(record)
    && fields.every((field) => typeof record[field] === 'string' && record[field].length > 0);
}
/** Accept only the two demonstration roles. */
function role(value) { return value === 'admin' || value === 'user'; }
/** Validate a password-free public identity. */
function sessionShape(value) {
  return strings(value, ['userId', 'username', 'displayName']) && role(value.role)
    && Object.keys(value).every((key) => ['userId', 'username', 'displayName', 'role'].includes(key));
}
/** Validate collection records and reject ambiguous identities. */
function collectionShape(value, key) {
  if (!Array.isArray(value)) return false;
  const fields = key === POSTS_KEY
    ? ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName']
    : ['id', 'displayName', 'username', 'password', 'createdAt'];
  if (!value.every((row) => strings(row, fields)
    && (key === POSTS_KEY || (role(row.role) && row.username !== 'admin')))) return false;
  if (new Set(value.map((row) => row.id)).size !== value.length) return false;
  return key === POSTS_KEY || new Set(value.map((row) => row.username)).size === value.length;
}
/** Build a safe failure without exposing browser exceptions or record contents. */
function failure(code, message) { return { ok: false, code, message }; }
/**
 * Read and validate one key, preserving missing versus unreadable status.
 * Args:
 *   key: Select the browser record boundary.
 * Returns:
 *   A validated value or a display-only fallback with its failure status.
 */
function read(key) {
  const fallback = key === SESSION_KEY ? null : [];
  let raw;
  try { raw = window.localStorage.getItem(key); }
  catch { return { ...failure('STORAGE_READ_FAILED', 'Browser storage is unavailable. No changes were made.'), value: fallback, status: 'unavailable' }; }
  if (raw === null) return { ok: true, value: fallback, status: 'missing' };
  let value;
  try { value = JSON.parse(raw); }
  catch { return { ...failure('INVALID_JSON', 'Saved data cannot be read. No changes were made.'), value: fallback, status: 'corrupt' }; }
  if (!(key === SESSION_KEY ? sessionShape(value) : collectionShape(value, key))) {
    return { ...failure('INVALID_SHAPE', 'Saved data has an invalid shape. No changes were made.'), value: fallback, status: 'corrupt' };
  }
  return { ok: true, value, status: 'valid' };
}
/** Return posts and their writable/read-only status; never raise. */
export function readPosts() { return read(POSTS_KEY); }
/** Return stored accounts and their writable/read-only status; never raise. */
export function readUsers() { return read(USERS_KEY); }
/** Return a validated public session or signed-out fallback; never raise. */
export function readSession() { return read(SESSION_KEY); }
/**
 * Save validated records only after checking existing collection readability.
 * Args:
 *   key: Select the persistence boundary.
 *   value: Supply the complete replacement record or collection.
 * Returns:
 *   Success only after the browser completes the write.
 */
function write(key, value) {
  if (!(key === SESSION_KEY ? sessionShape(value) : collectionShape(value, key))) {
    return failure('INVALID_SHAPE', 'Cannot save invalid records. No changes were made.');
  }
  if (key !== SESSION_KEY) {
    const existing = read(key);
    if (!existing.ok) return existing;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true, value };
  } catch {
    return failure('STORAGE_WRITE_FAILED', 'Could not save in this browser. Check site storage and try again.');
  }
}
/** Save a complete post collection without overwriting corrupt bytes. */
export function writePosts(value) { return write(POSTS_KEY, value); }
/** Save a complete account collection without overwriting corrupt bytes. */
export function writeUsers(value) { return write(USERS_KEY, value); }
/** Save only public session fields; never include passwords. */
export function writeSession(value) { return write(SESSION_KEY, value); }
/** Remove only the local session, reporting failure without pretending to sign out. */
export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
    return { ok: true, value: null };
  } catch {
    return failure('STORAGE_CLEAR_FAILED', 'Could not sign out in this browser. Check site storage and try again.');
  }
}
