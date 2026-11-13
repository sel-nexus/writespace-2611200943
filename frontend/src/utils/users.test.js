/** Verify account mutations against real local storage and changed action-time boundaries. */
import { beforeEach, expect, it, vi } from 'vitest';
import { createUser, deleteUser, allAccounts, deletionProtection, DEFAULT_ADMIN_TOOLTIP } from './users.js';
import { DEFAULT_ADMIN } from './auth.js';
import { USERS_KEY, SESSION_KEY, POSTS_KEY } from './storage.js';
const admin = { userId: 'a1', username: 'local-admin', displayName: 'Local admin', role: 'admin' };
const row = { id: 'u1', username: 'mira', displayName: 'Mira', password: 'demo-only', role: 'user', createdAt: '2026-01-01' };
const input = { displayName: ' New account ', username: ' new ', password: ' opaque ', role: 'user' };
beforeEach(() => { localStorage.setItem(SESSION_KEY, JSON.stringify(admin)); localStorage.setItem(USERS_KEY, JSON.stringify([row])); });
it.each(['admin', 'user'])('creates %s with UUID, ISO and no auto-session', (role) => {
  const before = localStorage.getItem(SESSION_KEY);
  const result = createUser({ ...input, role });
  expect(result.ok).toBe(true);
  expect(result.value).toMatchObject({ displayName: 'New account', username: 'new', password: ' opaque ', role });
  expect(result.value.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(new Date(result.value.createdAt).toISOString()).toBe(result.value.createdAt);
  expect(JSON.parse(localStorage.getItem(USERS_KEY))).toEqual([row, result.value]);
  expect(localStorage.getItem(SESSION_KEY)).toBe(before);
});
it('initializes only missing accounts and includes synthetic admin once', () => {
  localStorage.removeItem(USERS_KEY);
  expect(createUser(input).ok).toBe(true);
  expect(allAccounts([DEFAULT_ADMIN, row])).toEqual([DEFAULT_ADMIN, row]);
  expect(deletionProtection(DEFAULT_ADMIN, admin)).toBe(DEFAULT_ADMIN_TOOLTIP);
});
it.each(['displayName', 'username', 'password'])('blocks empty and invalid %s', (field) => {
  const before = localStorage.getItem(USERS_KEY);
  for (const value of ['', null, 8]) {
    expect(createUser({ ...input, [field]: value }).errors[field]).toBeTruthy();
    expect(localStorage.getItem(USERS_KEY)).toBe(before);
  }
});
it.each(['', 'owner', null])('rejects invalid role %s', (role) => {
  expect(createUser({ ...input, role }).errors.role).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(USERS_KEY))).toEqual([row]);
});
it.each([' admin ', ' mira '])('reserves and checks fresh duplicate %s', (username) => {
  expect(createUser({ ...input, username }).code).toBe('USERNAME_TAKEN');
  expect(JSON.parse(localStorage.getItem(USERS_KEY))).toEqual([row]);
});
it('checks duplicate inserted after prior creation and retains unrelated new rows', () => {
  const added = createUser(input).value;
  expect(createUser(input).code).toBe('USERNAME_TAKEN');
  expect(deleteUser(row.id).ok).toBe(true);
  expect(JSON.parse(localStorage.getItem(USERS_KEY))).toEqual([added]);
});
it.each(['create', 'delete'])('fresh nonadmin, missing and corrupt session blocks %s despite cached admin', (operation) => {
  const action = () => operation === 'create' ? createUser(input, admin) : deleteUser(row.id, admin);
  for (const raw of [JSON.stringify({ ...admin, role: 'user' }), null, '{broken', '{"role":"admin"}']) {
    if (raw === null) localStorage.removeItem(SESSION_KEY); else localStorage.setItem(SESSION_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(action().ok).toBe(false);
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
    expect(JSON.parse(localStorage.getItem(USERS_KEY))).toEqual([row]);
  }
});
it.each(['{broken', '{}', '[{}]', JSON.stringify([row, row])])('preserves unreadable accounts %s for both mutations', (raw) => {
  localStorage.setItem(USERS_KEY, raw);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(createUser(input).ok).toBe(false);
  expect(deleteUser(row.id).ok).toBe(false);
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem(USERS_KEY)).toBe(raw);
});
it.each([USERS_KEY, SESSION_KEY])('unavailable %s blocks both operations', (key) => {
  const original = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (name) { if (name === key) throw new Error('denied'); return original.call(this, name); });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(createUser(input).ok).toBe(false);
  expect(deleteUser(row.id).ok).toBe(false);
  expect(write).not.toHaveBeenCalled();
});
it.each(['create', 'delete'])('quota failure preserves records for %s', (operation) => {
  const before = localStorage.getItem(USERS_KEY);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
  expect((operation === 'create' ? createUser(input) : deleteUser(row.id)).code).toBe('STORAGE_WRITE_FAILED');
  expect(localStorage.getItem(USERS_KEY)).toBe(before);
});
it('blocks default, fresh self and missing target even on direct calls', () => {
  expect(deleteUser(DEFAULT_ADMIN.id).code).toBe('PROTECTED_ACCOUNT');
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...admin, userId: row.id }));
  expect(deleteUser(row.id).code).toBe('PROTECTED_ACCOUNT');
  expect(deleteUser('missing').code).toBe('USER_NOT_FOUND');
  expect(JSON.parse(localStorage.getItem(USERS_KEY))).toEqual([row]);
});
it('deletes eligible admin or user but never historical posts or session', () => {
  const historical = '[{"authorId":"u1","authorName":"Mira"}]';
  localStorage.setItem(POSTS_KEY, historical);
  localStorage.setItem(USERS_KEY, JSON.stringify([row, { ...row, id: 'a2', username: 'second', role: 'admin' }]));
  const session = localStorage.getItem(SESSION_KEY);
  expect(deleteUser('a2').ok).toBe(true);
  expect(deleteUser(row.id).ok).toBe(true);
  expect(localStorage.getItem(USERS_KEY)).toBe('[]');
  expect(localStorage.getItem(POSTS_KEY)).toBe(historical);
  expect(localStorage.getItem(SESSION_KEY)).toBe(session);
});
it('reports identity failure without writing', () => {
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
  expect(createUser(input).code).toBe('IDENTITY_FAILED');
  expect(JSON.parse(localStorage.getItem(USERS_KEY))).toEqual([row]);
});
