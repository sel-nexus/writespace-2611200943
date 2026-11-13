/** Verify credentials, account validation, partial completion and persisted state. */
import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_ADMIN, login, register, logout, currentRoleHome } from './auth.js';
import { USERS_KEY, SESSION_KEY, readUsers, readSession } from './storage.js';
const input = { displayName: ' Mira ', username: ' mira ', password: ' demo ', confirmation: ' demo ' };
const stored = { id: 'u1', displayName: 'Mira', username: 'mira', password: ' demo ', role: 'user', createdAt: 'today' };
describe('local authentication', () => {
  it('checks stable synthetic admin first even when users are corrupt or unreadable', () => {
    localStorage.setItem(USERS_KEY, '{bad');
    expect(login(' admin ', 'admin')).toMatchObject({ ok: true, redirectTo: '/admin', session: { userId: DEFAULT_ADMIN.id } });
    expect(readSession().value).not.toHaveProperty('password');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(login('admin', 'admin').ok).toBe(true);
  });
  it.each(['user', 'admin'])('maps stored %s without password', (role) => {
    localStorage.setItem(USERS_KEY, JSON.stringify([{ ...stored, role }]));
    const result = login(' mira ', ' demo ');
    expect(result).toEqual({ ok: true, session: { userId: 'u1', username: 'mira', displayName: 'Mira', role }, redirectTo: role === 'admin' ? '/admin' : '/blogs' });
    expect(readSession().value).toEqual(result.session);
    expect(currentRoleHome(result.session)).toBe(result.redirectTo);
  });
  it.each([['mira','demo'], ['Mira',' demo '], ['admin','wrong'], ['absent','demo']])('rejects exact credential mismatch %s/%s', (username,password) => {
    localStorage.setItem(USERS_KEY, JSON.stringify([stored]));
    expect(login(username,password).code).toBe('INVALID_CREDENTIALS');
    expect(readSession().value).toBeNull();
  });
  it.each([['', ''], [null, 'x'], [12, 'x'], ['   ', 'x'], ['mira', null], ['mira', 12]])('rejects invalid login input', (username,password) => {
    expect(login(username,password).code).toBe('VALIDATION_FAILED');
    expect(localStorage.length).toBe(0);
  });
  it('distinguishes missing credentials from corrupt and unavailable users', () => {
    expect(login('mira','demo').code).toBe('INVALID_CREDENTIALS');
    localStorage.setItem(USERS_KEY, '{}');
    expect(login('mira','demo').code).toBe('INVALID_SHAPE');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(login('mira','demo').code).toBe('STORAGE_READ_FAILED');
  });
  it('does not claim login success when session persistence fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(login('admin','admin').code).toBe('STORAGE_WRITE_FAILED');
    expect(readSession().value).toBeNull();
  });
  it('registers trimmed names and opaque passwords with UUID/time then clears only session', () => {
    const result = register(input);
    expect(result).toMatchObject({ ok: true, redirectTo: '/blogs' });
    const saved = readUsers().value[0];
    expect(saved).toMatchObject({ displayName: 'Mira', username: 'mira', password: ' demo ', role: 'user' });
    expect(saved.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
    expect(readSession().value).not.toHaveProperty('password');
    expect(logout().ok).toBe(true);
    expect(readSession().value).toBeNull();
    expect(readUsers().value).toEqual([saved]);
  });
  for (const field of Object.keys(input)) {
    it('requires correctly typed nonempty registration field ' + field, () => {
      for (const value of ['', null, 4]) {
        expect(register({ ...input, [field]: value })).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
        expect(localStorage.length).toBe(0);
      }
    });
  }
  it('rejects absent input, whitespace names, mismatch and reserved exact admin', () => {
    expect(register(undefined).code).toBe('VALIDATION_FAILED');
    expect(register({ ...input, displayName: ' ' }).errors.displayName).toBeTruthy();
    expect(register({ ...input, username: ' ' }).errors.username).toBeTruthy();
    expect(register({ ...input, confirmation: 'demo' }).errors.confirmation).toBe('Passwords must match.');
    expect(register({ ...input, username: ' admin ' }).errors.username).toBeTruthy();
    expect(localStorage.length).toBe(0);
  });
  it('rejects duplicate normalized username but permits case-sensitive names including Admin', () => {
    expect(register(input).ok).toBe(true);
    expect(register(input).code).toBe('USERNAME_TAKEN');
    expect(register({ ...input, username: 'Mira' }).ok).toBe(true);
    expect(register({ ...input, username: 'Admin' }).ok).toBe(true);
    expect(readUsers().value).toHaveLength(3);
  });
  it('preserves corrupt collection and refuses registration when reads fail', () => {
    localStorage.setItem(USERS_KEY, '{bad');
    expect(register(input).ok).toBe(false);
    expect(localStorage.getItem(USERS_KEY)).toBe('{bad');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(register(input).code).toBe('STORAGE_READ_FAILED');
  });
  it('retains empty state if user save or identity creation fails', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(register(input).code).toBe('STORAGE_WRITE_FAILED');
    expect(readUsers().value).toEqual([]);
    expect(readSession().value).toBeNull(); write.mockRestore();
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
    expect(register(input).code).toBe('IDENTITY_FAILED');
    expect(localStorage.length).toBe(0);
  });
  it('reports account saved/session failed and recovers by login without duplicate creation', () => {
    const original = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key,value) {
      if (key === SESSION_KEY) throw new Error('quota');
      original.call(this,key,value);
    });
    expect(register(input)).toMatchObject({ ok: false, code: 'PARTIAL_REGISTRATION', accountSaved: true, redirectTo: '/login' });
    expect(readUsers().value).toHaveLength(1);
    expect(readSession().value).toBeNull();
    expect(register(input).code).toBe('USERNAME_TAKEN'); write.mockRestore();
    expect(login('mira', ' demo ').ok).toBe(true);
    expect(readUsers().value).toHaveLength(1);
  });
  it('preserves active session when logout removal fails', () => {
    login('admin','admin');
    const before = readSession().value;
    vi.spyOn(Storage.prototype,'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(logout().code).toBe('STORAGE_CLEAR_FAILED');
    expect(readSession().value).toEqual(before);
  });
});
