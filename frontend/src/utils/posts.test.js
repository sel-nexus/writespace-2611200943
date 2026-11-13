/** Verify fresh authorization, complete validation and persisted mutation invariants. */
import { beforeEach, expect, it, vi } from 'vitest';
import { canManagePost, createPost, updatePost, deletePost } from './posts.js';
import { POSTS_KEY, SESSION_KEY, readPosts, readSession } from './storage.js';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = { id: 'p1', title: 'Original', content: 'Original words', createdAt: '2026-01-01', authorId: 'u1', authorName: 'Original author' };
const input = { title: ' Revised ', content: ' Line one\n  Line two ' };
/** Seed independent synthetic records before each operation. */
beforeEach(() => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(POSTS_KEY, JSON.stringify([post]));
});
const actions = [
  ['create', () => createPost(input, session)],
  ['update', () => updatePost('p1', input, session)],
  ['delete', () => deletePost('p1', session)],
];
it('creates UUID/ISO writing from fresh session, ignores injected identity and retains existing posts', () => {
  const fresh = { ...session, userId: 'u2', displayName: 'Changed name' };
  localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
  const result = createPost({ ...input, id: 'injected', authorId: 'u1', authorName: 'Fake', createdAt: 'fake' }, session);
  expect(result).toMatchObject({ ok: true, value: { ...input, authorId: 'u2', authorName: 'Changed name' } });
  expect(result.value.id).toMatch(/^[a-f0-9-]{36}$/);
  expect(new Date(result.value.createdAt).toISOString()).toBe(result.value.createdAt);
  expect(readPosts().value).toEqual([post, result.value]);
  expect(readSession().value).toEqual(fresh);
});
it('initializes only a missing post collection after an activated create', () => {
  localStorage.removeItem(POSTS_KEY);
  expect(readPosts().status).toBe('missing');
  const result = createPost(input);
  expect(result.ok).toBe(true);
  expect(readPosts().value).toEqual([result.value]);
});
it.each(['user', 'admin'])('allows %s update/delete while preserving identity and unrelated fresh records', (role) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, role, userId: role === 'admin' ? 'other' : 'u1' }));
  const other = { ...post, id: 'p2', authorId: 'other' };
  localStorage.setItem(POSTS_KEY, JSON.stringify([post, other]));
  expect(updatePost('p1', { ...input, id: 'fake', authorId: 'fake', authorName: 'fake', createdAt: 'fake' })).toEqual({ ok: true, value: { ...post, ...input } });
  expect(readPosts().value).toEqual([{ ...post, ...input }, other]);
  expect(deletePost('p1')).toEqual({ ok: true });
  expect(readPosts().value).toEqual([other]);
});
it('bases updates on the fresh record rather than original snapshot metadata', () => {
  const changed = { ...post, authorName: 'New snapshot', createdAt: 'changed' };
  localStorage.setItem(POSTS_KEY, JSON.stringify([changed]));
  expect(updatePost('p1', input).value).toEqual({ ...changed, ...input });
  expect(readPosts().value).toEqual([{ ...changed, ...input }]);
});
it.each([['update', () => updatePost('p1', input)], ['delete', () => deletePost('p1', { ...session, role: 'admin' })]])('%s rejects fresh session/ownership changes despite passed admin identity', (_, action) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, userId: 'other' }));
  expect(action()).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  expect(readPosts().value).toEqual([post]);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const changed = { ...post, authorId: 'other' };
  localStorage.setItem(POSTS_KEY, JSON.stringify([changed]));
  expect(action().code).toBe('FORBIDDEN');
  expect(readPosts().value).toEqual([changed]);
});
it.each([['update', () => updatePost('absent', input)], ['delete', () => deletePost('absent')]])('%s explicitly rejects absent targets and missing collections without initializing', (_, action) => {
  expect(action().code).toBe('POST_NOT_FOUND');
  expect(readPosts().value).toEqual([post]);
  localStorage.removeItem(POSTS_KEY);
  expect(action().code).toBe('POST_NOT_FOUND');
  expect(readPosts().status).toBe('missing');
});
for (const [name, action] of actions) {
  it.each([null, '{bad', '{}', JSON.stringify({ ...session, role: 'invalid' }), JSON.stringify({ ...session, password: 'forbidden' })])(name + ' fails closed on absent/invalid session %s', (raw) => {
    if (raw === null) localStorage.removeItem(SESSION_KEY); else localStorage.setItem(SESSION_KEY, raw);
    const before = { ...localStorage };
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(action().ok).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect({ ...localStorage }).toEqual(before);
    expect(readPosts().value).toEqual([post]);
  });
  it.each(['{bad', '{}', '[{"id":"broken"}]'])(name + ' preserves corrupt collection %s', (raw) => {
    localStorage.setItem(POSTS_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(action()).toMatchObject({ ok: false, status: 'corrupt' });
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
    expect(readPosts().status).toBe('corrupt');
  });
  it.each([POSTS_KEY, SESSION_KEY])(name + ' blocks unavailable read %s and preserves state after re-read', (key) => {
    const original = Storage.prototype.getItem;
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (item) {
      if (item === key) throw new Error('blocked');
      return original.call(this, item);
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(action()).toMatchObject({ ok: false, status: 'unavailable' });
    expect(write).not.toHaveBeenCalled();
    read.mockRestore();
    expect(readPosts().value).toEqual([post]);
    expect(readSession().value).toEqual(session);
  });
  it(name + ' reports write failure without changing saved state or session', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(action()).toMatchObject({ ok: false, code: 'STORAGE_WRITE_FAILED' });
    expect(readPosts().value).toEqual([post]);
    expect(readSession().value).toEqual(session);
  });
}
for (const action of [createPost, (value) => updatePost('p1', value)]) {
  it.each([undefined, null, {}, { title: '', content: '' }, { title: ' ', content: '\n' }, { title: 2, content: [] }])('validates both fields without any writes for %j', (value) => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(action(value)).toMatchObject({ ok: false, code: 'VALIDATION_FAILED', errors: { title: expect.any(String), content: expect.any(String) } });
    expect(write).not.toHaveBeenCalled();
    expect(readPosts().value).toEqual([post]);
  });
  it.each(['title', 'content'])('requires each individual field %s', (field) => {
    expect(action({ ...input, [field]: null }).errors).toEqual({ [field]: 'This field is required.' });
    expect(readPosts().value).toEqual([post]);
  });
}
it('returns identity failure without saving when UUID generation fails', () => {
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
  expect(createPost(input).code).toBe('IDENTITY_FAILED');
  expect(readPosts().value).toEqual([post]);
});
it('uses canManagePost only as owner/admin visibility and rejects absent/unknown roles', () => {
  expect(canManagePost(post, session)).toBe(true);
  expect(canManagePost(post, { ...session, role: 'admin', userId: 'other' })).toBe(true);
  for (const value of [null, { ...session, role: 'unknown' }, { ...session, userId: 'other' }]) expect(canManagePost(post, value)).toBe(false);
  expect(canManagePost(null, session)).toBe(false);
});
