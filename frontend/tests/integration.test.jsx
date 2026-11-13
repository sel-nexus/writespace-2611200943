/** Verify cross-feature local-storage flows using the real business helpers. */
import { beforeEach, describe, expect, it } from 'vitest';
import { login, logout, register } from '../src/utils/auth.js';
import { createPost, updatePost } from '../src/utils/posts.js';
import { createUser, deleteUser, allAccounts } from '../src/utils/users.js';
import { readPosts, readSession, readUsers, POSTS_KEY, USERS_KEY } from '../src/utils/storage.js';

beforeEach(() => localStorage.clear());

describe('local cross-feature workflows', () => {
  it('registers, publishes, signs in as admin, revises and removes an account without losing the author snapshot', () => {
    const joined = register({ displayName: 'Mira', username: 'mira', password: 'demo', confirmation: 'demo' });
    expect(joined.ok).toBe(true);
    const post = createPost({ title: 'First', content: 'A local note' });
    expect(post.ok).toBe(true);
    expect(post.value.authorId).toBe(joined.session.userId);
    expect(logout().ok).toBe(true);
    expect(login('admin', 'admin').ok).toBe(true);
    expect(updatePost(post.value.id, { title: 'Revised', content: 'A local note' }).ok).toBe(true);
    const adminAdded = createUser({ displayName: 'Other', username: 'other', password: 'demo', role: 'admin' });
    expect(adminAdded.ok).toBe(true);
    expect(allAccounts(readUsers().value)).toHaveLength(3);
    expect(deleteUser(joined.session.userId).ok).toBe(true);
    expect(readUsers().value.map((user) => user.username)).toEqual(['other']);
    expect(readPosts().value).toEqual([{ ...post.value, title: 'Revised' }]);
    expect(readSession().value.role).toBe('admin');
  });

  it('prevents a different signed-in writer from revising another writer and preserves unreadable collections', () => {
    const joined = register({ displayName: 'One', username: 'one', password: 'demo', confirmation: 'demo' });
    const post = createPost({ title: 'Private draft', content: 'Plain text' });
    expect(joined.ok && post.ok).toBe(true);
    expect(logout().ok).toBe(true);
    expect(register({ displayName: 'Two', username: 'two', password: 'demo', confirmation: 'demo' }).ok).toBe(true);
    expect(updatePost(post.value.id, { title: 'Unauthorized', content: 'Changed' }).code).toBe('FORBIDDEN');
    expect(readPosts().value).toEqual([post.value]);
    localStorage.setItem(POSTS_KEY, '{broken');
    expect(createPost({ title: 'Unsafe', content: 'No write' }).ok).toBe(false);
    expect(localStorage.getItem(POSTS_KEY)).toBe('{broken');
    localStorage.setItem(USERS_KEY, '{broken');
    expect(logout().ok).toBe(true);
    expect(register({ displayName: 'Three', username: 'three', password: 'demo', confirmation: 'demo' }).ok).toBe(false);
    expect(localStorage.getItem(USERS_KEY)).toBe('{broken');
    expect(readSession().value).toBeNull();
  });
});
