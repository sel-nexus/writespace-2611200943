/** Exercise discovery content, status distinctions and activated destinations. */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import LandingPage from './LandingPage.jsx';
import { POSTS_KEY, SESSION_KEY } from '../utils/storage.js';

/** Observe the address after native React Router link activation. */
function Address() {
  return <span aria-label="Address">{useLocation().pathname}</span>;
}
/** Mount discovery with an address observer for navigation assertions. */
function view() {
  return render(
    <MemoryRouter>
      <LandingPage />
      <Address />
    </MemoryRouter>,
  );
}
/** Build a complete synthetic stored post. */
function post(id, createdAt) {
  return { id, createdAt, title: id, content: 'x'.repeat(130), authorId: 'u', authorName: 'Mira' };
}
it.each([null, '[]'])('shows exact empty state for absent or empty collection %s without mutations', (raw) => {
  if (raw !== null) localStorage.setItem(POSTS_KEY, raw);
  const before = { ...localStorage };
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const confirm = vi.spyOn(window, 'confirm');
  view();
  expect(screen.getByRole('status')).toHaveTextContent('No posts yet — check back soon!');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Address')).toHaveTextContent('/');
  expect(write).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  expect({ ...localStorage }).toEqual(before);
  for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  expect(screen.getByRole('contentinfo')).toHaveTextContent(String(new Date().getFullYear()));
  expect(within(screen.getByRole('navigation', { name: 'Footer navigation' })).getAllByRole('link')).toHaveLength(4);
  expect(screen.getByLabelText('Writing preview illustration')).toHaveClass('motion-safe:animate-preview-float');
});
it('limits newest previews to three, preserves order and escapes content with safe dates', () => {
  const posts = [post('invalid', 'bad'), post('old', '2024-01-01'), post('<script>new</script>', '2026-06-01'), post('middle', '2025-01-01')];
  posts[2].content = '<img src=x onerror=alert(1)>';
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  view();
  const recent = screen.getByRole('heading', { name: 'Recent writing' }).parentElement;
  expect(within(recent).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['<script>new</script>', 'middle', 'old']);
  expect(within(recent).queryByText('invalid')).not.toBeInTheDocument();
  expect(within(recent).getAllByText('x'.repeat(120))).toHaveLength(2);
  expect(within(recent).getByText(/Jun 01, 2026/)).toBeInTheDocument();
  expect(recent.querySelector('img, script')).toBeNull();
  expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual(posts);
});
it.each(['{bad', '{}', '[{"id":"broken"}]'])('warns rather than claiming no posts for corrupt %s and retries without rewriting', async (raw) => {
  localStorage.setItem(POSTS_KEY, raw);
  view();
  expect(screen.getByRole('alert')).toHaveTextContent('local data is corrupt');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(localStorage.getItem(POSTS_KEY)).toBe(raw);
  localStorage.setItem(POSTS_KEY, JSON.stringify([post('restored', 'bad')]));
  await userEvent.click(screen.getByRole('button', { name: 'Retry loading posts' }));
  expect(screen.getByRole('link', { name: 'restored' })).toBeInTheDocument();
  expect(screen.getByText(/Date unavailable/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('distinguishes unavailable storage from empty records', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  view();
  expect(screen.getByRole('alert')).toHaveTextContent('browser storage cannot be read');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('refreshes posts and CTA identity on relevant storage events and clears; removes listeners', () => {
  const rendered = view();
  localStorage.setItem(POSTS_KEY, JSON.stringify([post('added', '2026-01-01')]));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })));
  expect(screen.queryByRole('link', { name: 'added' })).not.toBeInTheDocument();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: POSTS_KEY })));
  expect(screen.getByRole('link', { name: 'added' })).toBeInTheDocument();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: 'u', username: 'm', displayName: 'Mira', role: 'admin' }));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY })));
  expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
  localStorage.clear();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/login');
  const remove = vi.spyOn(window, 'removeEventListener');
  rendered.unmount();
  expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
});
it.each([
  ['Get Started Free', '/register'], ['Start Reading', '/login'], ['Home', '/'],
  ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register'],
])('activates guest landing %s to %s', async (name, destination) => {
  view();
  await userEvent.click(screen.getByRole('link', { name, exact: true }));
  expect(screen.getByLabelText('Address')).toHaveTextContent(destination);
});
it.each(['user', 'admin'])('sends signed-in %s reading to blogs and registration through its existing guard', async (role) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: 'u', username: 'm', displayName: 'Mira', role }));
  view();
  expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute('href', '/register');
  await userEvent.click(screen.getByRole('link', { name: 'Start Reading' }));
  expect(screen.getByLabelText('Address')).toHaveTextContent('/blogs');
});
it('links a preview to its encoded protected reader address', async () => {
  localStorage.setItem(POSTS_KEY, JSON.stringify([post('a/b', '2026-01-01')]));
  view();
  await userEvent.click(screen.getByRole('link', { name: 'a/b' }));
  expect(screen.getByLabelText('Address')).toHaveTextContent('/blog/a%2Fb');
});
