/** Exercise feed ordering, honest storage states and cross-tab invalidation. */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import Home from './Home.jsx';
import { POSTS_KEY, SESSION_KEY, readPosts } from '../utils/storage.js';

/** Build complete synthetic feed records. */
function post(id, createdAt = '2026-01-01') { return { id, title: id, content: 'x'.repeat(130), createdAt, authorId: 'u1', authorName: 'Mira' }; }
/** Mount the real feed within existing router semantics. */
function view() { return render(<MemoryRouter><Home /></MemoryRouter>); }
it.each([null, '[]'])('offers an empty CTA without writing or confirming for %s', (raw) => {
  if (raw) localStorage.setItem(POSTS_KEY, raw);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const confirm = vi.spyOn(window, 'confirm');
  view();
  expect(screen.getByRole('status')).toHaveTextContent('No posts yet');
  expect(screen.getByRole('link', { name: 'Write your first post' })).toHaveAttribute('href', '/write');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(write).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
});
it.each(['user', 'admin', 'other'])('sorts all posts immutably with responsive grid and %s edit eligibility', (role) => {
  const posts = [post('invalid', 'bad'), post('old', '2024-01-01'), post('new', '2026-06-01'), post('middle', '2025-01-01')];
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: role === 'other' ? 'u2' : 'u1', username: 'mira', displayName: 'Mira', role: role === 'admin' ? 'admin' : 'user' }));
  view();
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['new', 'middle', 'old', 'invalid']);
  expect(screen.getByLabelText('Blog feed')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  expect(screen.getAllByText('x'.repeat(120))).toHaveLength(4);
  expect(screen.queryAllByRole('link', { name: 'Edit' })).toHaveLength(role === 'other' ? 0 : 4);
  expect(readPosts().value).toEqual(posts);
});
it.each(['{bad', '{}', '[{"id":"broken"}]'])('preserves corrupt %s with actionable retry instead of empty state', async (raw) => {
  localStorage.setItem(POSTS_KEY, raw);
  view();
  expect(screen.getByRole('alert')).toHaveTextContent('corrupt');
  expect(screen.queryByRole('status')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Retry loading posts' }));
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  localStorage.setItem(POSTS_KEY, JSON.stringify([post('restored')]));
  await userEvent.click(screen.getByRole('button', { name: 'Retry loading posts' }));
  expect(screen.getByRole('link', { name: 'restored' })).toBeVisible();
});
it('shows unavailable access without claiming zero posts', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  view();
  expect(screen.getByRole('alert')).toHaveTextContent('browser storage cannot be read');
  expect(screen.queryByRole('status')).toBeNull();
});
it('refreshes collection/session/clear events, ignores unrelated keys and removes listeners', () => {
  const rendered = view();
  localStorage.setItem(POSTS_KEY, JSON.stringify([post('added')]));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'other' })));
  expect(screen.queryByRole('link', { name: 'added' })).toBeNull();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: POSTS_KEY })));
  expect(screen.getByRole('link', { name: 'added' })).toBeVisible();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' }));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY })));
  expect(screen.getByRole('link', { name: 'Edit' })).toBeVisible();
  localStorage.clear();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(screen.getByRole('status')).toBeVisible();
  const remove = vi.spyOn(window, 'removeEventListener');
  rendered.unmount();
  expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
});
