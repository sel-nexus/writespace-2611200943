/** Exercise shell content, storage preservation, and unmatched-route recovery. */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
      'A space for your words.',
    );
    expect(screen.getByRole('note')).toHaveTextContent('not secure authentication');
    expect(document.title).toBe('A space for your words. — WriteSpace browser-local demo');
    expect(screen.getByRole('note')).toHaveTextContent('Do not use real passwords');
    expect(screen.getByText(/Keep a separate copy of writing/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
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

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A space for your words.');
    expect(screen.queryByRole('link', { name: 'Return home' })).not.toBeInTheDocument();
  });

  /** Prove opening the shell does not initialize browser-local collections. */
  it('leaves initially empty storage empty', () => {
    renderShell();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
