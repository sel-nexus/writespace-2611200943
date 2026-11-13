/** Exercise activated public links, disclosures and local identity changes. */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { PublicNavbar } from './PublicNavbar.jsx';
import { SESSION_KEY } from '../utils/storage.js';

/** Observe actual link navigation without adding application behavior. */
function Address() {
  return <output aria-label="Address">{useLocation().pathname}</output>;
}
/** Mount the public navigation at the landing entry. */
function view() {
  return render(
    <MemoryRouter>
      <PublicNavbar />
      <Address />
    </MemoryRouter>,
  );
}
it.each([['Login', '/login'], ['Get Started', '/register'], ['WriteSpace', '/']])('activates guest %s to %s only on click', async (name, destination) => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  view();
  expect(screen.getByLabelText('Address')).toHaveTextContent('/');
  expect(write).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('link', { name, exact: true }));
  expect(screen.getByLabelText('Address')).toHaveTextContent(destination);
});
it.each(['user', 'admin'])('shows escaped %s identity and activates its role destination', async (role) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: 'u', username: 'mira', displayName: '<b>Mira</b>', role }));
  view();
  expect(screen.getByRole('img')).toHaveAccessibleName('<b>Mira</b> — ' + (role === 'admin' ? 'Administrator' : 'Writer'));
  expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  expect(document.querySelector('b')).toBeNull();
  await userEvent.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
  expect(screen.getByLabelText('Address')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
});
it('fails closed on malformed identity and refreshes only relevant events, including clears', () => {
  localStorage.setItem(SESSION_KEY, '{"role":"admin"}');
  const rendered = view();
  expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: 'u', username: 'm', displayName: 'Mira', role: 'user' }));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })));
  expect(screen.queryByText('Mira')).not.toBeInTheDocument();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY })));
  expect(screen.getByText('Mira')).toBeInTheDocument();
  localStorage.removeItem(SESSION_KEY);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  const remove = vi.spyOn(window, 'removeEventListener');
  rendered.unmount();
  expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
});
it('opens mobile navigation, closes on Escape and route activation', async () => {
  view();
  const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await userEvent.keyboard('{Escape}');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(toggle);
  await userEvent.click(screen.getByRole('link', { name: 'Login' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
