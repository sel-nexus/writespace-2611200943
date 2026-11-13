/** Exercise role access, fresh navigation and relevant cross-tab events. */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { SESSION_KEY, writeSession } from '../utils/storage.js';
const identity = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
/** Render representative test-only destinations rather than future product pages. */
function guard(path, props = {}) {
  return render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Link to="/protected">
          Enter protected
        </Link>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute {...props}>
                <p>Permitted content</p>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<p>Guest login</p>} />
          <Route path="/blogs" element={<p>Writer home</p>} />
          <Route path="/admin" element={<p>Admin home</p>} />
          <Route path="/" element={<p>Public</p>} />
        </Routes>
      </MemoryRouter>
    </React.StrictMode>,
  );
}
it.each([
  [null, {}, 'Guest login'], [null, {adminOnly:true}, 'Guest login'],
  [null, {guestOnly:true}, 'Permitted content'], ['user', {}, 'Permitted content'],
  ['admin', {}, 'Permitted content'], ['admin', {adminOnly:true}, 'Permitted content'],
  ['user', {adminOnly:true}, 'Writer home'], ['user', {guestOnly:true}, 'Writer home'],
  ['admin', {guestOnly:true}, 'Admin home'],
])('enforces role %s guard %j', (role,props,text) => {
  if (role) writeSession({...identity,role});
  const before = {...localStorage};
  guard('/protected',props);
  expect(screen.getByText(text)).toBeVisible();
  expect({...localStorage}).toEqual(before);
});
it.each(['{broken', '{}', '{"role":"admin"}'])('denies invalid session %s', (raw) => {
  localStorage.setItem(SESSION_KEY,raw);
  guard('/protected');
  expect(screen.getByText('Guest login')).toBeVisible();
  expect(localStorage.getItem(SESSION_KEY)).toBe(raw);
});
it('denies inaccessible storage', () => {
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(() => {throw new Error('blocked');});
  guard('/protected');
  expect(screen.getByText('Guest login')).toBeVisible();
});
it('rereads on route navigation without requiring a storage event', async () => {
  const user = userEvent.setup();
  writeSession(identity);
  guard('/');
  localStorage.removeItem(SESSION_KEY);
  await user.click(screen.getByRole('link',{name:'Enter protected'}));
  expect(screen.getByText('Guest login')).toBeVisible();
});
it.each([SESSION_KEY,null])('refreshes active guard on event %s without trusting payload', (key) => {
  writeSession({...identity,role:'admin'});
  guard('/protected',{adminOnly:true});
  writeSession(identity);
  act(() => window.dispatchEvent(new StorageEvent('storage',{key,newValue:'untrusted'})));
  expect(screen.getByText('Writer home')).toBeVisible();
});
it('ignores unrelated events then denies a corrupt fresh session', () => {
  writeSession(identity);
  guard('/protected');
  localStorage.setItem(SESSION_KEY,'{bad');
  act(() => window.dispatchEvent(new StorageEvent('storage',{key:'unrelated'})));
  expect(screen.getByText('Permitted content')).toBeVisible();
  act(() => window.dispatchEvent(new StorageEvent('storage',{key:SESSION_KEY})));
  expect(screen.getByText('Guest login')).toBeVisible();
});
it('renders nested Outlet content when no children are provided', () => {
  writeSession(identity);
  render(
    <MemoryRouter initialEntries={['/nested']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/nested" element={<p>Nested allowed</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText('Nested allowed')).toBeVisible();
});

it('refreshes a guest-only active route after another tab signs in', () => {
  guard('/protected', { guestOnly: true });
  writeSession(identity);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY })));
  expect(screen.getByText('Writer home')).toBeVisible();
});
