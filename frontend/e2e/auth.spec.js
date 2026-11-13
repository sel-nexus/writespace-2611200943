/** Exercise real browser-local auth journeys with fixture-enforced console capture. */
import { test, expect } from './fixtures.js';

/** Open responsive navigation only when the mobile toggle is visible. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}
/** Activate identity disclosure and the logout action without direct navigation. */
async function signOut(page, name) {
  await openNavigation(page);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL('/login');
}

test('register, logout, invalid login and login persist a real local identity', async ({ page, consoleErrors }) => {
  await page.goto('/');
  await openNavigation(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Register', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill(' Mira ');
  await page.getByLabel('Username', { exact: true }).fill(' mira ');
  await page.getByLabel('Password', { exact: true }).fill(' demo-only ');
  await page.getByLabel('Confirm password', { exact: true }).fill('mismatch');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('Passwords must match.')).toBeVisible();
  await page.getByLabel('Confirm password', { exact: true }).fill(' demo-only ');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL('/blogs');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ username: 'mira', displayName: 'Mira', role: 'user', password: ' demo-only ' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({
    userId: saved[0].id, username: 'mira', displayName: 'Mira', role: 'user',
  });
  await signOut(page, 'Mira');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('wrong');
  await page.getByLabel('Password', { exact: true }).fill(' demo-only ');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL('/blogs');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(saved);
  await signOut(page, 'Mira');
  expect(consoleErrors).toEqual([]);
});

test('fixed admin logs in even with corrupt users, exposes admin links and logs out', async ({ page, consoleErrors }) => {
  await page.addInitScript(() => localStorage.setItem('writespace_users', '{corrupt'));
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL('/admin');
  await openNavigation(page);
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('href', '/admin');
  await page.getByRole('button', { name: /Administrator/ }).click();
  await page.getByRole('link', { name: 'Manage users' }).click();
  await expect(page).toHaveURL('/users');
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe('{corrupt');
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(session.role).toBe('admin');
  expect(session).not.toHaveProperty('password');
  await signOut(page, 'Administrator');
  expect(consoleErrors).toEqual([]);
});

for (const path of ['/blogs', '/blog/example', '/write', '/edit/example', '/admin', '/users']) {
  test('guest direct entry denies ' + path, async ({ page, consoleErrors }) => {
    await page.goto(path);
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Log in', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(consoleErrors).toEqual([]);
  });
}
for (const role of ['user', 'admin']) {
  for (const path of ['/login', '/register']) {
    test(role + ' direct auth entry redirects from ' + path, async ({ page, consoleErrors }) => {
      await page.addInitScript((role) => localStorage.setItem('writespace_session', JSON.stringify({
        userId: 'test-identity', username: 'test', displayName: 'Test identity', role,
      })), role);
      await page.goto(path);
      await expect(page).toHaveURL(role === 'admin' ? '/admin' : '/blogs');
      await openNavigation(page);
      await expect(page.getByRole('button', { name: /Test identity/ })).toBeVisible();
      expect(consoleErrors).toEqual([]);
    });
  }
}
test('nonadmin direct admin entry returns to writer home', async ({ page, consoleErrors }) => {
  await page.addInitScript(() => localStorage.setItem('writespace_session', JSON.stringify({
    userId: 'test-writer', username: 'writer', displayName: 'Writer', role: 'user',
  })));
  await page.goto('/admin');
  await expect(page).toHaveURL('/blogs');
  await openNavigation(page);
  await page.getByRole('button', { name: /Writer/ }).click();
  await expect(page.getByRole('link', { name: 'Manage users' })).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});
test('invalid session cannot grant administrator entry', async ({ page, consoleErrors }) => {
  await page.addInitScript(() => localStorage.setItem('writespace_session', '{"role":"admin"}'));
  await page.goto('/users');
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe('{"role":"admin"}');
  expect(consoleErrors).toEqual([]);
});
