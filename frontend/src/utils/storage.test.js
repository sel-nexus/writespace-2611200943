/** Exercise schema integrity and every browser persistence failure boundary. */
import { describe, it, expect, vi } from 'vitest';
import * as storage from './storage.js';
const user = { id: 'u1', username: 'mira', displayName: 'Mira', password: 'demo', createdAt: 'invalid date allowed', role: 'user' };
const post = { id: 'p1', title: 'Title', content: 'Text', createdAt: 'invalid date allowed', authorId: 'u1', authorName: 'Mira' };
const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const collections = [
  [storage.USERS_KEY, storage.readUsers, storage.writeUsers, user],
  [storage.POSTS_KEY, storage.readPosts, storage.writePosts, post],
];
describe('validated collections', () => {
  for (const [key, read, write, row] of collections) {
    it(key + ' distinguishes missing writable emptiness and valid persistence', () => {
      expect(read()).toEqual({ ok: true, value: [], status: 'missing' });
      expect(write([row]).ok).toBe(true);
      expect(read()).toEqual({ ok: true, value: [row], status: 'valid' });
      expect(write([]).ok).toBe(true);
      expect(read().status).toBe('valid');
    });
    it.each(['{broken', '{}', 'null', '42', '[null]', '[{}]'])(key + ' preserves corrupt bytes %s', (raw) => {
      localStorage.setItem(key, raw);
      expect(read()).toMatchObject({ ok: false, status: 'corrupt', value: [] });
      expect(write([row]).ok).toBe(false);
      expect(localStorage.getItem(key)).toBe(raw);
    });
    for (const field of Object.keys(row)) {
      it(key + ' rejects missing and non-string/invalid field ' + field, () => {
        const missing = { ...row }; delete missing[field];
        for (const bad of [missing, { ...row, [field]: 1 }, { ...row, [field]: '' }]) {
          localStorage.setItem(key, JSON.stringify([bad]));
          expect(read()).toMatchObject({ ok: false, status: 'corrupt' });
          expect(write([bad]).code).toBe('INVALID_SHAPE');
        }
      });
    }
    it(key + ' rejects duplicate ids and invalid write inputs', () => {
      expect(write([row, row]).ok).toBe(false);
      expect(write({}).ok).toBe(false);
      localStorage.setItem(key, JSON.stringify([row, row]));
      expect(read().status).toBe('corrupt');
    });
    it(key + ' reports get and set failures without changing records', () => {
      localStorage.setItem(key, JSON.stringify([row]));
      const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('secret'); });
      expect(read()).toMatchObject({ ok: false, status: 'unavailable' });
      expect(write([]).ok).toBe(false); get.mockRestore();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota secret'); });
      expect(write([])).toMatchObject({ ok: false, code: 'STORAGE_WRITE_FAILED' });
      expect(read().value).toEqual([row]);
    });
  }
  it('rejects duplicate usernames and reserved admin, but permits exact case distinction and stored admin roles', () => {
    expect(storage.writeUsers([user, { ...user, id: 'u2' }]).ok).toBe(false);
    expect(storage.writeUsers([{ ...user, username: 'admin' }]).ok).toBe(false);
    expect(storage.writeUsers([user, { ...user, id: 'u2', username: 'Mira', role: 'admin' }]).ok).toBe(true);
    expect(storage.readUsers().value[1].role).toBe('admin');
  });
});
describe('session boundary', () => {
  it('reads missing, writes valid public identity and clears only session', () => {
    expect(storage.readSession()).toEqual({ ok: true, status: 'missing', value: null });
    expect(storage.writeSession(session).ok).toBe(true);
    expect(storage.readSession().value).toEqual(session);
    localStorage.setItem('keep', 'yes');
    expect(storage.clearSession()).toEqual({ ok: true, value: null });
    expect(storage.readSession().value).toBeNull();
    expect(localStorage.getItem('keep')).toBe('yes');
    expect(storage.clearSession().ok).toBe(true);
  });
  it.each(['{bad', 'null', '[]', '{}', '"text"'])('denies malformed session %s', (raw) => {
    localStorage.setItem(storage.SESSION_KEY, raw);
    expect(storage.readSession()).toMatchObject({ ok: false, value: null, status: 'corrupt' });
    expect(localStorage.getItem(storage.SESSION_KEY)).toBe(raw);
  });
  for (const field of Object.keys(session)) {
    it('denies missing, empty and wrong-type session field ' + field, () => {
      const missing = { ...session }; delete missing[field];
      for (const bad of [missing, { ...session, [field]: 2 }, { ...session, [field]: '' }]) {
        localStorage.setItem(storage.SESSION_KEY, JSON.stringify(bad));
        expect(storage.readSession().value).toBeNull();
        expect(storage.writeSession(bad).ok).toBe(false);
      }
    });
  }
  it('rejects passwords, unknown roles and preserves session on set/remove failure', () => {
    expect(storage.writeSession({ ...session, password: 'secret' }).ok).toBe(false);
    expect(storage.writeSession({ ...session, role: 'owner' }).ok).toBe(false);
    storage.writeSession(session);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('secret'); });
    expect(storage.writeSession({ ...session, role: 'admin' }).code).toBe('STORAGE_WRITE_FAILED');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('secret'); });
    expect(storage.clearSession().code).toBe('STORAGE_CLEAR_FAILED');
    expect(storage.readSession().value).toEqual(session);
  });
  it('handles unavailable property access for every operation', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    expect(storage.readSession().status).toBe('unavailable');
    expect(storage.readUsers().status).toBe('unavailable');
    expect(storage.readPosts().status).toBe('unavailable');
    expect(storage.writeSession(session).code).toBe('STORAGE_WRITE_FAILED');
    expect(storage.writeUsers([]).ok).toBe(false);
    expect(storage.writePosts([]).ok).toBe(false);
    expect(storage.clearSession().code).toBe('STORAGE_CLEAR_FAILED');
  });
});

it('reports session getItem failure distinctly and catches serialization failures', () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  expect(storage.readSession()).toMatchObject({ ok: false, status: 'unavailable', value: null });
  get.mockRestore();
  const circular = { ...post }; circular.extra = circular;
  expect(storage.writePosts([circular])).toMatchObject({ ok: false, code: 'STORAGE_WRITE_FAILED' });
  expect(storage.readPosts().status).toBe('missing');
});
