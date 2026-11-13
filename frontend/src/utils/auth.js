/** Authenticate demonstration accounts locally; this is not a security boundary. */
import { readUsers, writeUsers, writeSession, clearSession } from './storage.js';

export const DEFAULT_ADMIN = Object.freeze({
  id: 'writespace-default-admin', username: 'admin', displayName: 'Administrator', role: 'admin',
});
/** Choose the role destination for a validated session. */
export function currentRoleHome(session) { return session.role === 'admin' ? '/admin' : '/blogs'; }
/** Map an account to public session fields only. */
function toSession(user) {
  return { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
}
/** Return field errors for missing or incorrectly typed input; passwords remain opaque. */
function required(input, fields) {
  const errors = {};
  for (const field of fields) {
    const value = input?.[field];
    if (typeof value !== 'string' || !(field === 'password' || field === 'confirmation' ? value.length : value.trim().length)) {
      errors[field] = 'This field is required.';
    }
  }
  return errors;
}
/** Return a consistent field-level validation failure. */
function invalid(errors, code = 'VALIDATION_FAILED') {
  return { ok: false, code, message: 'Please correct the marked fields.', errors };
}
/** Persist the mapped session and report its confirmed destination. */
function signIn(user) {
  const session = toSession(user);
  const saved = writeSession(session);
  return saved.ok ? { ok: true, session, redirectTo: currentRoleHome(session) } : saved;
}
/**
 * Check fixed admin first, then exact stored credentials, without normalizing passwords.
 * Args:
 *   username: Supply an exact case-sensitive local account name.
 *   password: Supply opaque demonstration credentials.
 * Returns:
 *   A persisted public session or actionable failure; never raises.
 */
export function login(username, password) {
  const errors = required({ username, password }, ['username', 'password']);
  if (Object.keys(errors).length) return invalid(errors);
  username = username.trim();
  if (username === 'admin' && password === 'admin') return signIn(DEFAULT_ADMIN);
  const users = readUsers();
  if (!users.ok) return users;
  const user = users.value.find((row) => row.username === username && row.password === password);
  if (!user) return { ok: false, code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' };
  return signIn(user);
}
/**
 * Save a new writer before starting its session, reporting partial completion explicitly.
 * Args:
 *   input: Supply displayName, username, password and matching confirmation.
 * Returns:
 *   Confirmed sign-in, validation/storage failure, or account-saved login recovery.
 */
export function register(input) {
  const errors = required(input, ['displayName', 'username', 'password', 'confirmation']);
  if (!errors.confirmation && input.password !== input.confirmation) errors.confirmation = 'Passwords must match.';
  if (typeof input?.username === 'string' && input.username.trim() === 'admin') errors.username = 'This username is reserved.';
  if (Object.keys(errors).length) return invalid(errors);
  const users = readUsers();
  if (!users.ok) return users;
  const username = input.username.trim();
  if (users.value.some((row) => row.username === username)) return invalid({ username: 'This username is already taken.' }, 'USERNAME_TAKEN');
  let user;
  try {
    user = { id: crypto.randomUUID(), displayName: input.displayName.trim(), username,
      password: input.password, role: 'user', createdAt: new Date().toISOString() };
  } catch {
    return { ok: false, code: 'IDENTITY_FAILED', message: 'Could not create a local identity. Your form is still available.' };
  }
  const saved = writeUsers([...users.value, user]);
  if (!saved.ok) return saved;
  const signedIn = signIn(user);
  if (!signedIn.ok) return { ok: false, code: 'PARTIAL_REGISTRATION', accountSaved: true,
    message: 'Your account was saved, but sign-in failed. Check site storage, then log in.', redirectTo: '/login' };
  return signedIn;
}
/** Clear the session only on explicit activation and preserve failures. */
export function logout() { return clearSession(); }
