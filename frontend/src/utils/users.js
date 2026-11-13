/** Administer accounts with fresh, fail-closed local reads; never change posts or sessions. */
import { DEFAULT_ADMIN } from './auth.js';
import { readSession, readUsers, writeUsers } from './storage.js';

export const DEFAULT_ADMIN_TOOLTIP = 'Default admin cannot be deleted.';
/** Explain protected identities for display; mutations independently recheck. */
export function deletionProtection(user, session) {
  if (user.id === DEFAULT_ADMIN.id || user.username === DEFAULT_ADMIN.username) return DEFAULT_ADMIN_TOOLTIP;
  if (user.id === session?.userId) return 'You cannot delete your own account';
  return '';
}
/** Include the synthetic administrator once without persisting or modifying rows. */
export function allAccounts(users) {
  return [DEFAULT_ADMIN, ...users.filter((user) => user.id !== DEFAULT_ADMIN.id && user.username !== DEFAULT_ADMIN.username)];
}
/** Read both action boundaries and require an administrator, ignoring cached arguments. */
function fresh() {
  const session = readSession();
  const users = readUsers();
  if (!session.ok) return session;
  if (!session.value) return { ok: false, code: 'AUTH_REQUIRED', message: 'Please log in again before changing accounts.' };
  if (session.value.role !== 'admin') return { ok: false, code: 'FORBIDDEN', message: 'Only administrators can change accounts.' };
  if (!users.ok) return users;
  return { ok: true, session: session.value, users: users.value };
}
/** Return associated form errors without exposing credentials. */
function invalid(errors, code = 'VALIDATION_FAILED') {
  return { ok: false, code, message: 'Please correct the marked fields.', errors };
}
/**
 * Append an account only after fresh authorization and validation.
 * Args:
 *   input: Supply displayName, username, opaque password and admin/user role.
 * Returns:
 *   The saved UUID/ISO account or a failure; never starts a session.
 */
export function createUser(input) {
  const state = fresh();
  if (!state.ok) return state;
  const errors = {};
  for (const field of ['displayName', 'username', 'password']) {
    if (typeof input?.[field] !== 'string' || !(field === 'password' ? input[field].length : input[field].trim().length)) errors[field] = 'This field is required.';
  }
  if (!['admin', 'user'].includes(input?.role)) errors.role = 'Choose admin or user.';
  if (Object.keys(errors).length) return invalid(errors);
  const username = input.username.trim();
  if (username === DEFAULT_ADMIN.username || state.users.some((user) => user.username === username)) {
    return invalid({ username: 'This username is already taken.' }, 'USERNAME_TAKEN');
  }
  let user;
  try {
    user = { id: crypto.randomUUID(), displayName: input.displayName.trim(), username,
      password: input.password, role: input.role, createdAt: new Date().toISOString() };
  } catch {
    return { ok: false, code: 'IDENTITY_FAILED', message: 'Could not create a local identity. Your form is still available.' };
  }
  const saved = writeUsers([...state.users, user]);
  return saved.ok ? { ok: true, value: user } : saved;
}
/**
 * Remove one eligible fresh account without altering historical author snapshots.
 * Args:
 *   id: Identify the account; cached session arguments are ignored.
 * Returns:
 *   Success after persistence or failure preserving records.
 */
export function deleteUser(id) {
  const state = fresh();
  if (!state.ok) return state;
  if (id === DEFAULT_ADMIN.id || id === state.session.userId) return { ok: false, code: 'PROTECTED_ACCOUNT', message: id === DEFAULT_ADMIN.id ? DEFAULT_ADMIN_TOOLTIP : 'You cannot delete your own account' };
  const user = state.users.find((row) => row.id === id);
  if (!user) return { ok: false, code: 'USER_NOT_FOUND', message: 'Account not found. No changes were made.' };
  const reason = deletionProtection(user, state.session);
  if (reason) return { ok: false, code: 'PROTECTED_ACCOUNT', message: reason };
  const saved = writeUsers(state.users.filter((row) => row.id !== id));
  return saved.ok ? { ok: true } : saved;
}
