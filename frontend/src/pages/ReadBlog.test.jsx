/** Verify reader text, explicit confirmations, failure retention and fresh storage events. */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import ReadBlog from './ReadBlog.jsx';
import { POSTS_KEY, SESSION_KEY, readPosts } from '../utils/storage.js';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = { id: 'p1', title: '<b>Title</b>', content: ' first line\n\n  indented\ttext <script>alert(1)</script>', createdAt: '2026-06-01', authorId: 'u1', authorName: 'Mira' };
/** Expose the router address without mocking navigation. */
function Address() { return <output aria-label="Address">{useLocation().pathname}</output>; }
/** Mount a reader route with complete synthetic persisted state. */
function view(identity = session, id = 'p1', seed = true) {
  if (seed && identity) localStorage.setItem(SESSION_KEY, JSON.stringify(identity));
  if (seed && localStorage.getItem(POSTS_KEY) === null) localStorage.setItem(POSTS_KEY, JSON.stringify([post]));
  return render(
    <MemoryRouter initialEntries={['/blog/' + id]}>
      <Address />
      <Routes>
        <Route path="/blog/:id" element={<ReadBlog />} />
        <Route path="/blogs" element={<h1>Feed destination</h1>} />
        <Route path="/edit/:id" element={<h1>Edit destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}
it.each([['owner', session, true], ['other', { ...session, userId: 'other' }, false], ['admin', { ...session, userId: 'other', role: 'admin' }, true], ['guest', null, false]])('renders escaped whitespace and %s visibility with no render actions', (_, identity, allowed) => {
  localStorage.setItem(POSTS_KEY, JSON.stringify([post]));
  if (identity) localStorage.setItem(SESSION_KEY, JSON.stringify(identity));
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const confirm = vi.spyOn(window, 'confirm');
  const rendered = view(identity, 'p1', false);
  expect(write).not.toHaveBeenCalled();
  rendered.rerender(<MemoryRouter initialEntries={['/blog/p1']}><Address /><Routes><Route path="/blog/:id" element={<ReadBlog />} /></Routes></MemoryRouter>);
  expect(screen.getByLabelText('Post content').textContent).toBe(post.content);
  expect(screen.getByLabelText('Post content')).toHaveClass('whitespace-pre-wrap', 'break-words');
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(post.title);
  expect(rendered.container.querySelector('script, img, b')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete' }) !== null).toBe(allowed);
  expect(screen.queryByRole('link', { name: 'Edit' }) !== null).toBe(allowed);
  expect(write).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  expect(readPosts().value).toEqual([post]);
  expect(screen.getByLabelText('Address').textContent).toBe('/blog/p1');
});
it('cancel makes no storage calls and confirm removes only target then navigates', async () => {
  const other = { ...post, id: 'p2' };
  localStorage.setItem(POSTS_KEY, JSON.stringify([post, other]));
  view();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const read = vi.spyOn(Storage.prototype, 'getItem');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Address').textContent).toBe('/blog/p1');
  expect(readPosts().value).toEqual([post, other]);
  confirm.mockReturnValue(true);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(readPosts().value).toEqual([other]);
  expect(screen.getByLabelText('Address').textContent).toBe('/blogs');
});
it.each(['quota', 'session', 'ownership', 'missing', 'corrupt', 'unavailable'])('retains page and saved state on confirmed %s failure', async (failure) => {
  view();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  if (failure === 'session') localStorage.removeItem(SESSION_KEY);
  if (failure === 'ownership') localStorage.setItem(POSTS_KEY, JSON.stringify([{ ...post, authorId: 'other' }]));
  if (failure === 'missing') localStorage.setItem(POSTS_KEY, '[]');
  if (failure === 'corrupt') localStorage.setItem(POSTS_KEY, '{bad');
  const before = localStorage.getItem(POSTS_KEY);
  if (failure === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const read = failure === 'unavailable' ? vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); }) : null;
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByLabelText('Post content').textContent).toBe(post.content);
  expect(screen.getByLabelText('Address').textContent).toBe('/blog/p1');
  read?.mockRestore();
  expect(localStorage.getItem(POSTS_KEY)).toBe(before);
  expect(readPosts().status).toBe(failure === 'corrupt' ? 'corrupt' : 'valid');
});
it.each([null, '[]'])('shows missing target for %s and back navigation', async (raw) => {
  if (raw) localStorage.setItem(POSTS_KEY, raw);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  view(session, 'absent', false);
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  await userEvent.click(screen.getByRole('link', { name: 'Back to blogs' }));
  expect(screen.getByLabelText('Address').textContent).toBe('/blogs');
});
it.each(['{bad', '{}', '[{"id":"broken"}]'])('shows distinct corrupt state %s and recovers via retry', async (raw) => {
  localStorage.setItem(POSTS_KEY, raw);
  view();
  expect(screen.getByRole('alert')).toHaveTextContent('corrupt');
  expect(screen.queryByText('Post not found')).toBeNull();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  localStorage.setItem(POSTS_KEY, JSON.stringify([post]));
  await userEvent.click(screen.getByRole('button', { name: 'Retry loading posts' }));
  expect(screen.getByLabelText('Post content').textContent).toBe(post.content);
});
it('shows unavailable storage without controls', () => {
  const rendered = view();
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: POSTS_KEY })));
  expect(screen.getByRole('alert')).toHaveTextContent('Browser storage cannot be read');
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  rendered.unmount();
  read.mockRestore();
});
it('refreshes text, ownership/session and clear events, ignores unrelated keys and cleans listeners', () => {
  const rendered = view();
  const changed = { ...post, content: 'Changed words', authorId: 'other' };
  localStorage.setItem(POSTS_KEY, JSON.stringify([changed]));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })));
  expect(screen.getByLabelText('Post content').textContent).toBe(post.content);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: POSTS_KEY })));
  expect(screen.getByLabelText('Post content').textContent).toBe(changed.content);
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, role: 'admin' }));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY })));
  expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
  localStorage.clear();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  const remove = vi.spyOn(window, 'removeEventListener');
  rendered.unmount();
  expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
});
it('activates the edit link without changing storage', async () => {
  view();
  await userEvent.click(screen.getByRole('link', { name: 'Edit' }));
  expect(screen.getByLabelText('Address').textContent).toBe('/edit/p1');
  expect(readPosts().value).toEqual([post]);
});
