/** Exercise shell content, storage preservation, and unmatched-route recovery. */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SESSION_KEY } from './utils/storage.js';
import { describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

/**
 * Render the real route table at a specified entry in StrictMode.
 *
 * Args:
 *   path: Supply the address a visitor opens.
 * Returns:
 *   The testing-library render controls.
 */
function renderShell(path = '/') {
  return render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </React.StrictMode>,
  );
}

describe('local-demo shell', () => {
  /** Prove the root explains the product and local data boundaries. */
  it('renders a useful home introduction and demo warning', () => {
    renderShell();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Your thoughts. Your space. Beautifully simple.',
    );
    expect(screen.getByRole('note')).toHaveTextContent('not secure authentication');
    expect(document.title).toBe('Your thoughts. Your space. Beautifully simple. — WriteSpace browser-local demo');
    expect(screen.getByRole('note')).toHaveTextContent('Do not use real passwords');
    expect(screen.getByText(/Keep a separate copy of writing/)).toBeVisible();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
  });

  /** Prove rendering preserves corrupt bytes and does not seed or rewrite storage. */
  it('does not mutate local or session storage when rendered or rerendered', () => {
    localStorage.setItem('users', '{invalid collection');
    localStorage.setItem('unrelated', 'keep me');
    sessionStorage.setItem('session', 'preserve these bytes');
    const localBefore = { ...localStorage };
    const sessionBefore = { ...sessionStorage };
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const clear = vi.spyOn(Storage.prototype, 'clear');

    const view = renderShell();
    view.rerender(
      <React.StrictMode>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </React.StrictMode>,
    );

    expect({ ...localStorage }).toEqual(localBefore);
    expect({ ...sessionStorage }).toEqual(sessionBefore);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  /** Prove unknown entries remain informative and recover through an activated link. */
  it('shows an unmatched-route home link that returns to the introduction', async () => {
    const user = userEvent.setup();
    renderShell('/unmatched/deep-entry');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This page isn’t here.');
    expect(document.title).toBe('This page isn’t here. — WriteSpace browser-local demo');
    expect(screen.getByRole('note')).toBeVisible();
    expect(screen.queryByText('A space for your words.')).not.toBeInTheDocument();
    const home = screen.getByRole('link', { name: 'Return home' });
    expect(home).toHaveAttribute('href', '/');

    await user.click(home);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your thoughts. Your space. Beautifully simple.');
    expect(screen.queryByRole('link', { name: 'Return home' })).not.toBeInTheDocument();
  });

  /** Prove opening the shell does not initialize browser-local collections. */
  it('leaves initially empty storage empty', () => {
    renderShell();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

/** Expose current address to prove actual App redirects rather than fallback text alone. */
function Address() {
  return <output aria-label="Current address">{useLocation().pathname}</output>;
}
/** Render App routing with a visible test-only address observer. */
function routeView(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Address />
      <App />
    </MemoryRouter>,
  );
}
it.each(['/blogs','/blog/test','/write','/edit/test','/admin','/users'])('App denies guest direct route %s',path=>{
  routeView(path);
  expect(screen.getByLabelText('Current address')).toHaveTextContent('/login');
  expect(screen.getByRole('heading',{name:'Log in',exact:true})).toBeVisible();
  expect(screen.getByRole('note')).toHaveTextContent('Do not use real passwords');
});
it.each([
  ['user','/login','/blogs'],['user','/register','/blogs'],['admin','/login','/admin'],['admin','/register','/admin'],
  ['user','/admin','/blogs'],['user','/users','/blogs'],['admin','/admin','/admin'],['admin','/users','/users'],
  ['user','/blogs','/blogs'],['admin','/blogs','/blogs'],
])('App resolves %s at %s to %s without fake future pages',(role,path,destination)=>{
  localStorage.setItem(SESSION_KEY,JSON.stringify({userId:'u1',username:'mira',displayName:'Mira',role}));
  routeView(path);
  expect(screen.getByLabelText('Current address')).toHaveTextContent(destination);
  expect(screen.getByRole('heading',{level:1})).toHaveTextContent(destination === '/blogs' ? 'All Blogs' : 'This page isn’t here.');
  expect(screen.getByRole('note')).toBeVisible();
});

/** Prove discovery actions traverse the real protected route groups. */
it.each([
  [null, 'Start Reading', '/login'], [null, 'Get Started Free', '/register'],
  [null, 'All Blogs', '/login'], [null, 'preview', '/login'],
  ['user', 'Start Reading', '/blogs'], ['admin', 'Start Reading', '/blogs'],
  ['user', 'Get Started Free', '/blogs'], ['admin', 'Get Started Free', '/admin'],
  ['user', 'Go to Dashboard', '/blogs'], ['admin', 'Go to Dashboard', '/admin'],
  ['user', 'preview', '/blog/p1'], ['admin', 'preview', '/blog/p1'],
  ['user', 'Login', '/blogs'], ['admin', 'Register', '/admin'],
])('discovery %s activates %s through guards to %s', async (role, name, destination) => {
  localStorage.setItem('writespace_posts', JSON.stringify([{ id: 'p1', title: 'preview', content: 'Local words',
    createdAt: '2026-01-01', authorId: 'u1', authorName: 'Mira' }]));
  if (role) localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: 'u1', username: 'mira', displayName: 'Mira', role }));
  const before = { ...localStorage };
  routeView('/');
  expect(screen.getByLabelText('Current address').textContent).toBe('/');
  await userEvent.click(screen.getByRole('link', { name, exact: true }));
  expect(screen.getByLabelText('Current address').textContent).toBe(destination);
  expect({ ...localStorage }).toEqual(before);
  expect(screen.getAllByRole('banner')).toHaveLength(1);
  expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  expect(screen.getByRole('note')).toBeVisible();
});
