/** Exercise escaped preview content, cycling accents and activated role links. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { BlogCard } from './BlogCard.jsx';

const post = { id: 'a/b', title: '<script>Title</script>', content: '<img src=x onerror=alert(1)>' + 'x'.repeat(130), createdAt: '2026-06-01', authorId: 'u1', authorName: 'Mira' };
/** Expose actual link navigation without a second router. */
function Address() { return <output aria-label="Address">{useLocation().pathname}</output>; }
it.each([['owner', { userId: 'u1', role: 'user' }, true], ['other', { userId: 'u2', role: 'user' }, false], ['admin', { userId: 'u2', role: 'admin' }, true], ['guest', null, false]])('renders %s controls and plain text without actions on render', async (_, session, allowed) => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const confirm = vi.spyOn(window, 'confirm');
  const view = render(<MemoryRouter><BlogCard post={post} session={session} /><Address /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: 'Edit' }) !== null).toBe(allowed);
  expect(screen.getByText(post.content.slice(0, 120))).toBeVisible();
  expect(screen.getByText('Jun 01, 2026')).toBeVisible();
  expect(screen.getByRole('img', { name: 'Mira — Writer' })).toBeVisible();
  expect(view.container.querySelector('img, script')).toBeNull();
  expect(write).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Address').textContent).toBe('/');
  await userEvent.click(screen.getByRole('link', { name: post.title }));
  expect(screen.getByLabelText('Address').textContent).toBe('/blog/a%2Fb');
  if (allowed) {
    await userEvent.click(screen.getByRole('link', { name: 'Edit' }));
    expect(screen.getByLabelText('Address').textContent).toBe('/edit/a%2Fb');
  }
});
it.each([[0, 'border-t-primary-300'], [1, 'border-t-secondary-300'], [2, 'border-t-primary-500'], [3, 'border-t-primary-300']])('cycles accent %i and handles invalid dates', (index, accent) => {
  render(<MemoryRouter><BlogCard post={{ ...post, createdAt: 'bad' }} index={index} /></MemoryRouter>);
  expect(screen.getByRole('article')).toHaveClass(accent);
  expect(screen.getByText('Date unavailable')).toBeVisible();
});
