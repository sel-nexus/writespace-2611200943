/** Verify real admin pages, persistence, confirmations and action-time races. */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminDashboard from './AdminDashboard.jsx';
import UserManagement from './UserManagement.jsx';
import { DEFAULT_ADMIN } from '../utils/auth.js';
import { POSTS_KEY, USERS_KEY, SESSION_KEY } from '../utils/storage.js';
const session = { userId: 'a1', username: 'local-admin', displayName: 'Local admin', role: 'admin' };
const users = [
  { id: 'a1', username: 'local-admin', displayName: 'Local admin', password: 'demo', role: 'admin', createdAt: '2026-01-01' },
  { id: 'u1', username: 'mira', displayName: 'Mira', password: 'demo', role: 'user', createdAt: '2026-01-01' },
];
const posts = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, title: 'Post ' + i, content: 'Words', createdAt: '2026-01-0' + (i + 1), authorId: 'u1', authorName: 'Mira' }));
beforeEach(() => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
});
/** Render pages with real link navigation and minimal destination observers. */
function view(page = 'dashboard') {
  return render(
    <MemoryRouter initialEntries={[page === 'dashboard' ? '/admin' : '/users']}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/blogs" element={<h1>Feed destination</h1>} />
        <Route path="/write" element={<h1>Write destination</h1>} />
        <Route path="/edit/:id" element={<h1>Edit destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}
/** Populate required account fields by accessible labels. */
async function fill(role = 'user') {
  await userEvent.type(screen.getByLabelText('Display name', { exact: true }), ' New account ');
  await userEvent.type(screen.getByLabelText('Username', { exact: true }), ' new ');
  await userEvent.type(screen.getByLabelText('Password', { exact: true }), ' demo ');
  await userEvent.selectOptions(screen.getByLabelText('Role', { exact: true }), role);
}
/** Simulate cross-tab notification after changing actual storage. */
function event(key) { act(() => window.dispatchEvent(new StorageEvent('storage', { key }))); }
it('counts fixed admin once and selects newest five without render actions', () => {
  const before = { ...localStorage };
  const confirm = vi.spyOn(window, 'confirm');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  view();
  for (const [label, count] of [['Total Posts', 6], ['Total Users', 3], ['Total Admins', 2], ['Total Registered Users', 1]]) {
    expect(screen.getByLabelText(label)).toHaveTextContent(String(count));
  }
  expect(screen.getAllByRole('link', { name: /^Post/ }).map((link) => link.textContent)).toEqual(['Post 5', 'Post 4', 'Post 3', 'Post 2', 'Post 1']);
  expect(confirm).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect({ ...localStorage }).toEqual(before);
});
it('missing collections show legitimate zero and synthetic admin counts', () => {
  localStorage.removeItem(POSTS_KEY); localStorage.removeItem(USERS_KEY);
  view();
  expect(screen.getByLabelText('Total Posts')).toHaveTextContent('0');
  expect(screen.getByLabelText('Total Users')).toHaveTextContent('1');
  expect(screen.getByLabelText('Total Admins')).toHaveTextContent('1');
  expect(screen.getByLabelText('Total Registered Users')).toHaveTextContent('0');
  expect(screen.getByRole('status')).toHaveTextContent('No posts yet');
});
it.each([POSTS_KEY, USERS_KEY])('unreadable %s is not a zero and preserves bytes on retry', async (key) => {
  localStorage.setItem(key, '{corrupt');
  view();
  expect(screen.getByLabelText(key === POSTS_KEY ? 'Total Posts' : 'Total Users')).toHaveTextContent('Unavailable');
  expect(screen.getByRole('alert')).toHaveTextContent('corrupt');
  await userEvent.click(screen.getByRole('button', { name: 'Retry loading data' }));
  expect(localStorage.getItem(key)).toBe('{corrupt');
});
it.each(['Write New Post', 'Manage Users', 'Edit Post 5'])('activates %s', async (name) => {
  view(); await userEvent.click(screen.getByRole('link', { name }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(name === 'Manage Users' ? 'Manage Users' : name === 'Write New Post' ? 'Write destination' : 'Edit destination');
});
it('post cancellation preserves bytes, then confirmed deletion routes to blogs', async () => {
  const before = localStorage.getItem(POSTS_KEY);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  view(); await userEvent.click(screen.getByRole('button', { name: 'Delete Post 5' }));
  expect(localStorage.getItem(POSTS_KEY)).toBe(before);
  confirm.mockReturnValue(true);
  await userEvent.click(screen.getByRole('button', { name: 'Delete Post 5' }));
  expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual(posts.slice(0, 5));
  expect(screen.getByRole('heading')).toHaveTextContent('Feed destination');
});
it.each(['nonadmin', 'missing', 'corrupt', 'quota'])('fresh %s blocks dashboard deletion', async (race) => {
  view();
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    if (race === 'nonadmin') localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, role: 'user' }));
    if (race === 'missing') localStorage.setItem(POSTS_KEY, '[]');
    if (race === 'corrupt') localStorage.setItem(POSTS_KEY, '{corrupt');
    if (race === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    return true;
  });
  await userEvent.click(screen.getByRole('button', { name: 'Delete Post 5' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Admin Dashboard');
  expect(screen.getByRole('alert')).toBeVisible();
  expect(localStorage.getItem(POSTS_KEY)).toBe(race === 'missing' ? '[]' : race === 'corrupt' ? '{corrupt' : JSON.stringify(posts));
});
it.each(['user', 'admin'])('creates %s without changing session and refreshes list', async (role) => {
  const before = localStorage.getItem(SESSION_KEY);
  view('users'); await fill(role);
  await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
  const saved = JSON.parse(localStorage.getItem(USERS_KEY));
  expect(saved).toHaveLength(3);
  expect(saved[2]).toMatchObject({ username: 'new', displayName: 'New account', password: ' demo ', role });
  expect(localStorage.getItem(SESSION_KEY)).toBe(before);
  expect(screen.getByRole('status')).toHaveTextContent('Account created');
  expect(screen.getByLabelText('Username', { exact: true })).toHaveValue('');
  expect(within(screen.getByRole('table')).getByRole('button', { name: 'Delete new' })).toBeEnabled();
});
it('required fields expose associated errors and retain values on duplicate', async () => {
  view('users'); await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
  for (const label of ['Display name', 'Username', 'Password', 'Role']) expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await fill();
  await userEvent.clear(screen.getByLabelText('Username', { exact: true }));
  await userEvent.type(screen.getByLabelText('Username', { exact: true }), 'admin');
  await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
  expect(screen.getByLabelText('Username', { exact: true })).toHaveAccessibleDescription('This username is already taken.');
  expect(screen.getByLabelText('Password', { exact: true })).toHaveValue(' demo ');
  expect(JSON.parse(localStorage.getItem(USERS_KEY))).toEqual(users);
});
it.each(['duplicate', 'corrupt', 'unavailable', 'nonadmin', 'quota'])('fresh %s on create retains draft and records', async (race) => {
  view('users'); await fill();
  if (race === 'duplicate') localStorage.setItem(USERS_KEY, JSON.stringify([...users, { ...users[1], id: 'new-id', username: 'new' }]));
  if (race === 'corrupt') localStorage.setItem(USERS_KEY, '{corrupt');
  if (race === 'nonadmin') localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, role: 'user' }));
  const before = localStorage.getItem(USERS_KEY);
  if (race === 'unavailable') {
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) { if (key === USERS_KEY) throw new Error('denied'); return original.call(this, key); });
  }
  if (race === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
  await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  expect(screen.getByLabelText('Username', { exact: true })).toHaveValue(' new ');
  expect(screen.getByLabelText('Password', { exact: true })).toHaveValue(' demo ');
  vi.restoreAllMocks(); expect(localStorage.getItem(USERS_KEY)).toBe(before);
});
it('protects default and self, cancels eligible removal then keeps historical posts', async () => {
  view('users');
  const table = within(screen.getByRole('table'));
  expect(table.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
  expect(table.getByRole('button', { name: 'Delete local-admin' })).toBeDisabled();
  const before = { ...localStorage };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await userEvent.click(table.getByRole('button', { name: 'Delete mira' }));
  expect({ ...localStorage }).toEqual(before);
  confirm.mockReturnValue(true);
  await userEvent.click(table.getByRole('button', { name: 'Delete mira' }));
  expect(JSON.parse(localStorage.getItem(USERS_KEY))).toEqual([users[0]]);
  expect(localStorage.getItem(POSTS_KEY)).toBe(before[POSTS_KEY]);
  expect(table.queryByRole('button', { name: 'Delete mira' })).not.toBeInTheDocument();
});
it.each(['missing', 'self', 'nonadmin', 'corrupt', 'quota'])('confirmation-time %s blocks account deletion', async (race) => {
  view('users');
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    if (race === 'missing') localStorage.setItem(USERS_KEY, JSON.stringify([users[0]]));
    if (race === 'self') localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, userId: 'u1' }));
    if (race === 'nonadmin') localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, role: 'user' }));
    if (race === 'corrupt') localStorage.setItem(USERS_KEY, '{corrupt');
    if (race === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    return true;
  });
  await userEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Delete mira' }));
  expect(screen.getByRole('alert')).toBeVisible();
  expect(localStorage.getItem(USERS_KEY)).toBe(race === 'missing' ? JSON.stringify([users[0]]) : race === 'corrupt' ? '{corrupt' : JSON.stringify(users));
});
it('dashboard events refresh counts, corruption and session controls while ignoring unrelated keys', () => {
  view();
  localStorage.setItem(POSTS_KEY, '[]'); event('unrelated');
  expect(screen.getByLabelText('Total Posts')).toHaveTextContent('6');
  event(POSTS_KEY); expect(screen.getByLabelText('Total Posts')).toHaveTextContent('0');
  localStorage.setItem(USERS_KEY, '[]'); event(USERS_KEY);
  expect(screen.getByLabelText('Total Users')).toHaveTextContent('1');
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts)); event(POSTS_KEY);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, role: 'user' })); event(SESSION_KEY);
  expect(screen.queryByRole('button', { name: 'Delete Post 5' })).not.toBeInTheDocument();
  localStorage.setItem(USERS_KEY, '{corrupt'); event(null);
  expect(screen.getByLabelText('Total Users')).toHaveTextContent('Unavailable');
});
it('account events refresh list and protections without losing draft; corrupt is distinct', async () => {
  view('users'); await fill();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, userId: 'u1' })); event(SESSION_KEY);
  expect(within(screen.getByRole('table')).getByRole('button', { name: 'Delete mira' })).toBeDisabled();
  localStorage.setItem(USERS_KEY, '[]'); event('unrelated');
  expect(within(screen.getByRole('table')).getByRole('button', { name: 'Delete mira' })).toBeInTheDocument();
  event(USERS_KEY); expect(within(screen.getByRole('table')).queryByRole('button', { name: 'Delete mira' })).not.toBeInTheDocument();
  localStorage.setItem(USERS_KEY, '{corrupt'); event(null);
  expect(screen.getByRole('alert')).toHaveTextContent('corrupt');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Username', { exact: true })).toHaveValue(' new ');
  await userEvent.click(screen.getByRole('button', { name: 'Retry loading accounts' }));
  expect(localStorage.getItem(USERS_KEY)).toBe('{corrupt');
});

it('pairs dashboard metric, metadata, error and destructive styles for dark mode', () => {
  localStorage.setItem(USERS_KEY, '{corrupt');
  view();
  const metric = screen.getByLabelText('Total Users');
  expect(metric).toHaveTextContent('Unavailable');
  expect(metric).toHaveClass('bg-surface', 'dark:bg-slate-800', 'dark:border-slate-700');
  expect(within(metric).getByText('Unavailable')).toHaveClass('dark:text-slate-100');
  expect(screen.getByRole('alert')).toHaveClass('text-error-foreground', 'dark:text-red-300');
  expect(screen.getAllByText(/Mira ·/)[0]).toHaveClass('dark:text-slate-300');
  expect(screen.getByRole('button', { name: 'Delete Post 5' })).toHaveClass('dark:text-red-300', 'dark:focus-visible:ring-indigo-300');
});

it('keeps forms, responsive account rows, validation and protection readable in dark mode', async () => {
  view('users');
  const username = screen.getByLabelText('Username', { exact: true });
  expect(username).toHaveClass('bg-surface', 'dark:bg-slate-800', 'dark:text-slate-100', 'dark:focus-visible:ring-indigo-300');
  expect(screen.getByLabelText('Role', { exact: true })).toHaveClass('dark:bg-slate-800', 'dark:text-slate-100');
  await userEvent.click(screen.getByRole('button', { name: 'Create User' }));
  expect(document.getElementById('username-error')).toHaveClass('text-error-foreground', 'dark:text-red-300');
  const table = within(screen.getByRole('table'));
  expect(table.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
  expect(table.getByRole('button', { name: 'Delete mira' })).toHaveClass('dark:text-red-300', 'dark:focus-visible:ring-indigo-300');
  const card = screen.getByRole('article', { name: 'Account mira' });
  expect(card).toHaveClass('bg-surface', 'dark:bg-slate-900', 'dark:border-slate-700');
  expect(within(card).getByText('user')).toHaveClass('dark:bg-slate-700', 'dark:text-slate-100');
});
