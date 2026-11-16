/** Follow public discovery journeys using real local storage and automatic console capture. */
import { test, expect } from './fixtures.js';

/** Reveal public navigation on small viewports before activating a link. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}

test('guest discovers newest previews, enters guarded reading and joins from the landing CTA', async ({ page, consoleErrors }) => {
  const posts = [
    { id: 'old', title: 'Older notes', content: 'Old local writing', createdAt: '2024-01-01', authorId: 'm', authorName: 'Mira' },
    { id: 'new', title: '<b>Newest notes</b>', content: '<script>Plain text only</script>', createdAt: '2026-06-01', authorId: 'm', authorName: 'Mira' },
    { id: 'middle', title: 'Middle notes', content: 'm'.repeat(130), createdAt: '2025-01-01', authorId: 'm', authorName: 'Mira' },
    { id: 'invalid', title: 'Invalid dated notes', content: 'Preserve me', createdAt: 'invalid', authorId: 'm', authorName: 'Mira' },
  ];
  await page.addInitScript((posts) => localStorage.setItem('writespace_posts', JSON.stringify(posts)), posts);
  await page.goto('/');
  const recent = page.getByRole('heading', { name: 'Recent writing' }).locator('..');
  await expect(recent.getByRole('heading', { level: 3 })).toHaveText(['<b>Newest notes</b>', 'Middle notes', 'Older notes']);
  await expect(recent.getByText('m'.repeat(120), { exact: true })).toBeVisible();
  await expect(recent.getByText(/Jun 01, 2026/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  await recent.getByRole('link', { name: '<b>Newest notes</b>', exact: true }).click();
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await expect(page).toHaveURL('/register');
  await page.getByLabel('Display name', { exact: true }).fill('Discovery writer');
  await page.getByLabel('Username', { exact: true }).fill('discovery');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL('/blogs');
  const accounts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(accounts).toHaveLength(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({
    userId: accounts[0].id, username: 'discovery', displayName: 'Discovery writer', role: 'user',
  });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  expect(consoleErrors).toEqual([]);
});

for (const role of ['user', 'admin']) {
  test(role + ' activates public role home, registration redirect, reading and preview', async ({ page, consoleErrors }) => {
    const session = { userId: 'writer', username: 'writer', displayName: 'Local writer', role };
    await page.addInitScript((session) => {
      localStorage.setItem('writespace_session', JSON.stringify(session));
      localStorage.setItem('writespace_posts', JSON.stringify([{ id: 'p1', title: 'Local preview', content: 'Saved words', createdAt: 'bad', authorId: 'writer', authorName: 'Local writer' }]));
    }, session);
    await page.goto('/');
    await openNavigation(page);
    await expect(page.getByRole('img', { name: /Local writer/ })).toBeVisible();
    await page.getByRole('link', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(role === 'admin' ? '/admin' : '/blogs');
    await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
    await page.getByRole('link', { name: 'Get Started Free' }).click();
    await expect(page).toHaveURL(role === 'admin' ? '/admin' : '/blogs');
    await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
    await page.getByRole('link', { name: 'Start Reading' }).click();
    await expect(page).toHaveURL('/blogs');
    await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
    await expect(page.getByText(/Date unavailable/)).toBeVisible();
    await page.getByRole('link', { name: 'Local preview' }).click();
    await expect(page).toHaveURL('/blog/p1');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toHaveLength(1);
    expect(consoleErrors).toEqual([]);
  });
}

test('empty and corrupt posts stay distinct and cross-tab storage events refresh discovery', async ({ page, context, consoleErrors }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('No posts yet — check back soon!');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBeNull();
  const other = await context.newPage();
  const otherErrors = [];
  other.on('console', (message) => { if (message.type() === 'error') otherErrors.push(message.text()); });
  other.on('pageerror', (error) => otherErrors.push(error.message));
  await other.goto('/');
  await other.evaluate(() => localStorage.setItem('writespace_posts', '{corrupt'));
  await expect(page.getByRole('alert')).toContainText('local data is corrupt');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry loading posts' }).click();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{corrupt');
  await other.evaluate(() => localStorage.setItem('writespace_posts', JSON.stringify([{ id: 'restored', title: 'Restored writing', content: 'From the other tab', createdAt: '2026-01-01', authorId: 'u', authorName: 'Mira' }])));
  await expect(page.getByRole('link', { name: 'Restored writing' })).toBeVisible();
  await other.evaluate(() => localStorage.clear());
  await expect(page.getByRole('status')).toHaveText('No posts yet — check back soon!');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(otherErrors).toEqual([]);
  await other.close();
  expect(consoleErrors).toEqual([]);
});


test('dark discovery and auth surfaces remain readable through navigation and validation', async ({ page, consoleErrors }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('writespace_posts', JSON.stringify([
    { id: 'theme', title: 'Dark preview', content: 'Visible writing', createdAt: '2026-01-01', authorId: 'u', authorName: 'Mira' },
  ])));
  await page.goto('/');
  const preview = page.getByLabel('Writing preview illustration');
  const lightBackground = await preview.evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(preview).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  expect(await preview.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(lightBackground);
  const hero = page.getByRole('region', { name: 'Your thoughts. Your space. Beautifully simple.' });
  await expect(hero).toHaveCSS('background-image', /gradient/);
  const story = page.getByRole('link', { name: 'Dark preview' });
  await expect(story.locator('xpath=ancestor::article')).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expect(page.getByText(/Mira ·/)).toHaveCSS('color', 'rgb(203, 213, 225)');
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await expect(page).toHaveURL('/register');
  const username = page.getByLabel('Username', { exact: true });
  await expect(username).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expect(username).toHaveCSS('color', 'rgb(241, 245, 249)');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  const registerError = page.locator('#username-error');
  await expect(registerError).toBeVisible();
  await expect(registerError).toHaveCSS('color', 'rgb(252, 165, 165)');
  await page.getByRole('link', { name: 'Log in', exact: true }).last().click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByLabel('Username', { exact: true })).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.locator('#username-error')).toHaveCSS('color', 'rgb(252, 165, 165)');
  expect(consoleErrors).toEqual([]);
});
