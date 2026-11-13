/** Exercise metrics, responsive identities and action-only callbacks. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { StatCard } from './StatCard.jsx';
import { UserRow } from './UserRow.jsx';
import { DEFAULT_ADMIN } from '../utils/auth.js';
import { DEFAULT_ADMIN_TOOLTIP } from '../utils/users.js';
const user = { id: 'u1', username: 'mira', displayName: '<b>Mira</b>', role: 'user', createdAt: 'bad' };
it.each([0, 12, null])('labels metric %s distinctly', (value) => {
  render(<StatCard label="Total Posts" value={value} />);
  expect(screen.getByLabelText('Total Posts')).toHaveTextContent(value === null ? 'Unavailable' : String(value));
});
it.each([true, false])('renders responsive identity and activates eligible deletion mobile=%s', async (mobile) => {
  const onDelete = vi.fn();
  const view = mobile ? <UserRow user={user} onDelete={onDelete} mobile /> : <table><tbody><UserRow user={user} onDelete={onDelete} /></tbody></table>;
  render(view);
  expect(screen.getByRole('img')).toHaveAccessibleName('<b>Mira</b> — Writer');
  expect(screen.getByText('Date unavailable')).toBeVisible();
  expect(screen.getByText('<b>Mira</b>')).toBeVisible();
  expect(onDelete).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Delete mira' }));
  expect(onDelete).toHaveBeenCalledWith('u1');
});
it.each([true, false])('default admin has exact tooltip in both presentations %s', async (mobile) => {
  const onDelete = vi.fn();
  render(mobile ? <UserRow user={DEFAULT_ADMIN} mobile onDelete={onDelete} /> : <table><tbody><UserRow user={DEFAULT_ADMIN} onDelete={onDelete} /></tbody></table>);
  const button = screen.getByRole('button', { name: 'Delete admin' });
  expect(button).toBeDisabled();
  expect(DEFAULT_ADMIN_TOOLTIP).toBe('Default admin cannot be deleted.');
  expect(button).toHaveAttribute('title', DEFAULT_ADMIN_TOOLTIP);
  expect(button).toHaveAccessibleDescription(DEFAULT_ADMIN_TOOLTIP);
  await userEvent.click(button);
  expect(onDelete).not.toHaveBeenCalled();
});
it('protects current account and shows role/date', () => {
  render(<UserRow user={{ ...user, role: 'admin', createdAt: '2026-01-01' }} session={{ userId: 'u1' }} onDelete={vi.fn()} mobile />);
  expect(screen.getByRole('button')).toBeDisabled();
  expect(screen.getByRole('button')).toHaveAccessibleDescription('You cannot delete your own account');
  expect(screen.getByText('admin')).toBeVisible();
  expect(screen.getByText('Jan 01, 2026')).toBeVisible();
});
