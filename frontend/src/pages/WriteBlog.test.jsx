/** Exercise real post mutations, retained input and safe editor navigation. */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import WriteBlog from './WriteBlog.jsx';
import { POSTS_KEY, SESSION_KEY } from '../utils/storage.js';

const owner = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const original = { id: 'p1', title: 'Original', content: ' Original\n  text ', createdAt: '2026-01-01', authorId: 'u1', authorName: 'Original author' };
beforeEach(() => localStorage.setItem(SESSION_KEY, JSON.stringify(owner)));

/** Observe actual navigation rather than mocking the router. */
function Address() {
  return (
    <output aria-label="Address">{useLocation().pathname}</output>
  );
}
/** Mount the real editor in StrictMode with observable recovery destinations. */
function view(path = '/write', posts = [original]) {
  if (posts !== null) localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  return render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Address />
        <Routes>
          <Route path="/write" element={<WriteBlog />} />
          <Route path="/edit/:id" element={<WriteBlog />} />
          <Route path="/blogs" element={<h1>Feed</h1>} />
          <Route path="/blog/:id" element={<h1>Reader</h1>} />
        </Routes>
      </MemoryRouter>
    </React.StrictMode>,
  );
}
/** Enter text exactly, including intentional whitespace. */
function fill(title = 'Draft title', content = ' Draft\n  content ') {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } });
  fireEvent.change(screen.getByLabelText('Content'), { target: { value: content } });
}
/** Activate submission through its visible button. */
async function save() {
  await userEvent.click(screen.getByRole('button', { name: /Publish Blog|Save Changes/ }));
}
/** Notify the editor after changing real localStorage. */
function notify(key) {
  act(() => window.dispatchEvent(new StorageEvent('storage', { key })));
}

it('render, rerender and input never write, remove, confirm or navigate; counter follows text', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const confirm = vi.spyOn(window, 'confirm');
  const page = view('/write', null);
  expect(screen.getByText('0 characters')).toBeVisible();
  fill('Title', 'a\nb ');
  expect(screen.getByText('4 characters')).toHaveTextContent('4 characters');
  expect(screen.getByText('4 characters')).toHaveAttribute('aria-live', 'polite');
  expect(screen.getByLabelText('Content')).toHaveClass('min-h-64');
  notify(POSTS_KEY);
  expect(screen.getByLabelText('Address')).toHaveTextContent('/write');
  page.rerender(
    <React.StrictMode>
      <MemoryRouter initialEntries={['/write']}>
        <WriteBlog />
      </MemoryRouter>
    </React.StrictMode>,
  );
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  expect(localStorage.getItem(POSTS_KEY)).toBeNull();
});

it('associates both required field errors and corrects each independently without writes', async () => {
  view();
  fill('  ', '\n ');
  const before = localStorage.getItem(POSTS_KEY);
  await save();
  for (const field of ['Title', 'Content']) {
    expect(screen.getByLabelText(field)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(field)).toHaveAccessibleDescription(/This field is required/);
    expect(screen.getByLabelText(field)).toHaveAttribute('aria-required', 'true');
  }
  expect(screen.getAllByText('This field is required.')).toHaveLength(2);
  fill('Valid', ' ');
  await save();
  expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'false');
  expect(screen.getByLabelText('Content')).toHaveAttribute('aria-invalid', 'true');
  fill(' ', 'Valid');
  await save();
  expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Content')).toHaveAttribute('aria-invalid', 'false');
  expect(localStorage.getItem(POSTS_KEY)).toBe(before);
  expect(screen.getByLabelText('Address')).toHaveTextContent('/write');
});

it.each(['user', 'admin'])('%s creation uses fresh session identity and navigates after persistence', async (role) => {
  view('/write', null);
  fill();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...owner, role, userId: 'fresh', displayName: 'Fresh identity' }));
  await save();
  const [post] = JSON.parse(localStorage.getItem(POSTS_KEY));
  expect(post).toMatchObject({ title: 'Draft title', content: ' Draft\n  content ', authorId: 'fresh', authorName: 'Fresh identity' });
  expect(post.id).toMatch(/^[a-f0-9-]{36}$/);
  expect(Number.isNaN(Date.parse(post.createdAt))).toBe(false);
  expect(screen.getByLabelText('Address').textContent).toBe('/blog/' + post.id);
});

it.each(['user', 'admin'])('%s edit prefills and preserves id, author snapshot and timestamp', async (role) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...owner, role, userId: role === 'admin' ? 'admin' : 'u1' }));
  view('/edit/p1');
  expect(screen.getByLabelText('Title')).toHaveValue(original.title);
  expect(screen.getByLabelText('Content')).toHaveValue(original.content);
  fill();
  await save();
  expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([{ ...original, title: 'Draft title', content: ' Draft\n  content ' }]);
  expect(screen.getByLabelText('Address')).toHaveTextContent('/blog/p1');
});

it('direct nonowner edit redirects without exposing input or changing data', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...owner, userId: 'other' }));
  view('/edit/p1');
  expect(screen.getByLabelText('Address')).toHaveTextContent('/blogs');
  expect(screen.queryByLabelText('Content')).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([original]);
});

it('missing target provides a feed link without initializing absent posts', async () => {
  view('/edit/missing', null);
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await userEvent.click(screen.getByRole('link', { name: 'Back to blogs' }));
  expect(screen.getByLabelText('Address')).toHaveTextContent('/blogs');
  expect(localStorage.getItem(POSTS_KEY)).toBeNull();
});

it.each(['session', 'changed user', 'ownership', 'deletion', 'corrupt', 'unavailable', 'quota'])('fresh %s failure retains edit input without navigation or writes', async (failure) => {
  view('/edit/p1');
  fill();
  if (failure === 'session') localStorage.removeItem(SESSION_KEY);
  if (failure === 'changed user') localStorage.setItem(SESSION_KEY, JSON.stringify({ ...owner, userId: 'other' }));
  if (failure === 'ownership') localStorage.setItem(POSTS_KEY, JSON.stringify([{ ...original, authorId: 'other' }]));
  if (failure === 'deletion') localStorage.setItem(POSTS_KEY, '[]');
  if (failure === 'corrupt') localStorage.setItem(POSTS_KEY, '{corrupt');
  const before = localStorage.getItem(POSTS_KEY);
  if (failure === 'unavailable') {
    const get = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === POSTS_KEY) throw new DOMException('Blocked', 'SecurityError');
      return get.call(this, key);
    });
  }
  if (failure === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await save();
  expect(screen.getByRole('alert')).toHaveTextContent(/No changes|log in|Only the author|Could not save/);
  expect(screen.getByLabelText('Title')).toHaveValue('Draft title');
  expect(screen.getByLabelText('Content')).toHaveValue(' Draft\n  content ');
  expect(screen.getByLabelText('Address')).toHaveTextContent('/edit/p1');
  vi.restoreAllMocks();
  expect(localStorage.getItem(POSTS_KEY)).toBe(before);
});

it.each(['/write', '/edit/p1'])('cancel at %s discards only unsaved text and never writes', async (path) => {
  view(path);
  fill();
  const before = { ...localStorage };
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(screen.getByLabelText('Address').textContent).toBe(path === '/write' ? '/blogs' : '/blog/p1');
  expect({ ...localStorage }).toEqual(before);
  expect(write).not.toHaveBeenCalled();
});

it('refreshes relevant state, ignores unrelated events and keeps drafts across post and session changes', async () => {
  view('/edit/p1');
  fill();
  localStorage.setItem(POSTS_KEY, '{corrupt');
  notify('unrelated');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  notify(POSTS_KEY);
  expect(screen.getByRole('alert')).toHaveTextContent('corrupt');
  expect(screen.getByLabelText('Content')).toHaveValue(' Draft\n  content ');
  const added = { ...original, id: 'p2', title: 'Other tab' };
  localStorage.setItem(POSTS_KEY, JSON.stringify([{ ...original, title: 'Remote revision' }, added]));
  notify(null);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue('Draft title');
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...owner, userId: 'other' }));
  notify(SESSION_KEY);
  expect(screen.getByRole('alert')).toHaveTextContent('Only the author');
  expect(screen.getByLabelText('Content')).toHaveValue(' Draft\n  content ');
  localStorage.setItem(SESSION_KEY, JSON.stringify(owner));
  notify(SESSION_KEY);
  await save();
  expect(JSON.parse(localStorage.getItem(POSTS_KEY))).toEqual([{ ...original, title: 'Draft title', content: ' Draft\n  content ' }, added]);
});

it('cross-tab deletion keeps text and cancel safely returns to feed', async () => {
  view('/edit/p1');
  fill();
  localStorage.setItem(POSTS_KEY, '[]');
  notify(POSTS_KEY);
  expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
  expect(screen.getByLabelText('Content')).toHaveValue(' Draft\n  content ');
  await save();
  expect(localStorage.getItem(POSTS_KEY)).toBe('[]');
  await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(screen.getByLabelText('Address')).toHaveTextContent('/blogs');
});

it('initial corrupt edit recovers and prefills once when readable data returns', () => {
  localStorage.setItem(POSTS_KEY, '{corrupt');
  view('/edit/p1', null);
  expect(screen.getByRole('heading', { name: 'Posts unavailable' })).toBeVisible();
  expect(screen.queryByLabelText('Content')).not.toBeInTheDocument();
  expect(localStorage.getItem(POSTS_KEY)).toBe('{corrupt');
  localStorage.setItem(POSTS_KEY, JSON.stringify([original]));
  notify(POSTS_KEY);
  expect(screen.getByLabelText('Content')).toHaveValue(original.content);
});

it.each(['corrupt', 'unavailable', 'quota', 'missing session', 'invalid session'])('creation %s failure retains text without navigation', async (failure) => {
  view('/write', null);
  fill();
  if (failure === 'corrupt') localStorage.setItem(POSTS_KEY, '{corrupt');
  if (failure === 'missing session') localStorage.removeItem(SESSION_KEY);
  if (failure === 'invalid session') localStorage.setItem(SESSION_KEY, '{invalid');
  const before = localStorage.getItem(POSTS_KEY);
  if (failure === 'unavailable') {
    const get = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === POSTS_KEY) throw new DOMException('Blocked', 'SecurityError');
      return get.call(this, key);
    });
  }
  if (failure === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await save();
  expect(screen.getByRole('alert')).toHaveTextContent('Your unsaved text is still available');
  expect(screen.getByLabelText('Title')).toHaveValue('Draft title');
  expect(screen.getByLabelText('Content')).toHaveValue(' Draft\n  content ');
  expect(screen.getByLabelText('Address').textContent).toBe('/write');
  vi.restoreAllMocks();
  expect(localStorage.getItem(POSTS_KEY)).toBe(before);
});

it('initial unavailable edit reports storage error, not missing post, without writes', () => {
  const get = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (key === POSTS_KEY) throw new DOMException('Blocked', 'SecurityError');
    return get.call(this, key);
  });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  view('/edit/p1', null);
  expect(screen.getByRole('heading', { name: 'Posts unavailable' })).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('Browser storage cannot be read');
  expect(screen.getByRole('link', { name: 'Back to blogs' })).toHaveAttribute('href', '/blogs');
  expect(write).not.toHaveBeenCalled();
});

it('quota failure can retry the retained edit once storage works', async () => {
  view('/edit/p1');
  fill();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await save();
  expect(screen.getByLabelText('Content')).toHaveValue(' Draft\n  content ');
  vi.restoreAllMocks();
  await save();
  expect(screen.getByLabelText('Address').textContent).toBe('/blog/p1');
  expect(JSON.parse(localStorage.getItem(POSTS_KEY))[0]).toEqual({ ...original, title: 'Draft title', content: ' Draft\n  content ' });
});

it('pairs editor fields, controls and validation errors with dark styles', async () => {
  view('/write', null);
  expect(screen.getByRole('heading', { name: 'Write a Blog' }).closest('section')).toHaveClass('dark:bg-slate-900', 'dark:text-slate-100');
  for (const name of ['Title', 'Content']) {
    expect(screen.getByLabelText(name)).toHaveClass('bg-surface', 'dark:bg-slate-800', 'dark:text-slate-100', 'dark:border-slate-600', 'dark:focus:ring-indigo-300');
  }
  expect(screen.getByRole('link', { name: 'Cancel' })).toHaveClass('dark:hover:bg-slate-700');
  expect(screen.getByRole('button', { name: 'Publish Blog' })).toHaveClass('dark:bg-indigo-700', 'dark:focus-visible:ring-offset-slate-900');
  await save();
  for (const error of screen.getAllByText('This field is required.')) {
    expect(error).toHaveClass('text-error-foreground', 'dark:text-red-300');
  }
  expect(localStorage.getItem(POSTS_KEY)).toBeNull();
});
