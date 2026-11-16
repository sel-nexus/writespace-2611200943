/** Follow public discovery journeys using real local storage and automatic console capture. */
import { test, expect } from './fixtures.js';

/** Reveal public navigation on small viewports before activating a link. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}

/** Compare computed foreground with the composited solid ancestor backgrounds. */
async function expectReadable(locator) {
  await expect(locator).toBeVisible();
  const result = await locator.evaluate((element) => {
    const parse = (color) => {
      const match = color.match(/^rgba?\(([^)]+)\)$/);
      if (!match) throw new Error(`Unsupported computed color: ${color}`);
      const parts = match[1].split(/[,/\s]+/).filter(Boolean).map(Number);
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const blend = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (!alpha) return [0, 0, 0, 0];
      return [0, 1, 2].map((i) => (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha)
        .concat(alpha);
    };
    let background = [0, 0, 0, 0];
    for (let node = element; node && background[3] < 0.999999; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (Number(style.opacity) !== 1 || style.backgroundImage !== 'none') {
        throw new Error(`Cannot calculate solid background for ${node.tagName}: ${style.backgroundImage}, opacity ${style.opacity}`);
      }
      background = blend(background, parse(style.backgroundColor));
    }
    if (background[3] < 0.999999) throw new Error('No opaque rendered background found');
    const foreground = blend(parse(getComputedStyle(element).color), background);
    const luminance = (color) => color.slice(0, 3).reduce((sum, channel, i) => {
      const value = channel / 255;
      return sum + [0.2126, 0.7152, 0.0722][i] * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    }, 0);
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return { foreground, background, ratio: (values[0] + 0.05) / (values[1] + 0.05) };
  });
  expect(result.ratio, `Text contrast: ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(4.5);
}

/** Verify persistence and the class that activates the theme styles. */
async function expectTheme(page, theme) {
  await expect.poll(() => page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe(theme);
  if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  else await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
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
  await expectTheme(page, 'light');
  await expectReadable(preview.getByText('A little room to think'));
  await openNavigation(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expectTheme(page, 'dark');
  await expect(preview).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  expect(await preview.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(lightBackground);
  await expectReadable(preview.getByText('A little room to think'));
  const hero = page.getByRole('region', { name: 'Your thoughts. Your space. Beautifully simple.' });
  await expect(hero).toHaveCSS('background-image', /gradient/);
  const story = page.getByRole('link', { name: 'Dark preview' });
  await expect(story.locator('xpath=ancestor::article')).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expect(page.getByText(/Mira ·/)).toHaveCSS('color', 'rgb(203, 213, 225)');
  await expectReadable(page.getByText(/Mira ·/));
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await expect(page).toHaveURL('/register');
  await expectTheme(page, 'dark');
  const username = page.getByLabel('Username', { exact: true });
  await expect(username).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expect(username).toHaveCSS('color', 'rgb(241, 245, 249)');
  await username.fill('theme-reader');
  await expectReadable(username);
  await username.clear();
  await expectReadable(page.getByRole('heading', { name: 'Create your local account' }));
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  const registerError = page.locator('#username-error');
  await expect(registerError).toBeVisible();
  await expect(registerError).toHaveCSS('color', 'rgb(252, 165, 165)');
  await expectReadable(registerError);
  await page.getByRole('link', { name: 'Log in', exact: true }).last().click();
  await expect(page).toHaveURL('/login');
  await expectTheme(page, 'dark');
  await expect(page.getByLabel('Username', { exact: true })).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expectReadable(page.getByRole('heading', { name: 'Log in' }));
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.locator('#username-error')).toHaveCSS('color', 'rgb(252, 165, 165)');
  await expectReadable(page.locator('#username-error'));
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Dark preview' }).click();
  await expect(page).toHaveURL('/blog/theme');
  await expectTheme(page, 'dark');
  await expectReadable(page.getByLabel('Post content'));
  expect(consoleErrors).toEqual([]);
});

test('light auth, reader and error text contrast with their effective backgrounds', async ({ page, consoleErrors }) => {
  await page.addInitScript(() => localStorage.setItem('writespace_posts', JSON.stringify([
    { id: 'light', title: 'Light preview', content: 'Visible light writing', createdAt: '2026-01-01', authorId: 'u', authorName: 'Mira' },
  ])));
  await page.goto('/');
  await expectTheme(page, 'light');
  await openNavigation(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expectTheme(page, 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expectTheme(page, 'light');
  await expectReadable(page.getByLabel('Writing preview illustration').getByText('A little room to think'));
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await expectTheme(page, 'light');
  await page.getByLabel('Username', { exact: true }).fill('theme-reader');
  await expectReadable(page.getByLabel('Username', { exact: true }));
  await page.getByLabel('Username', { exact: true }).clear();
  await expectReadable(page.getByRole('heading', { name: 'Create your local account' }));
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expectReadable(page.locator('#username-error'));
  await page.getByRole('link', { name: 'Log in', exact: true }).last().click();
  await expectTheme(page, 'light');
  await expectReadable(page.getByRole('heading', { name: 'Log in' }));
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expectReadable(page.locator('#username-error'));
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Light preview' }).click();
  await expect(page).toHaveURL('/blog/light');
  await expectReadable(page.getByLabel('Post content'));
  expect(consoleErrors).toEqual([]);
});

test('unmatched route remains readable after switching to dark mode', async ({ page, consoleErrors }) => {
  await page.goto('/unmatched/contrast');
  await expectTheme(page, 'light');
  await openNavigation(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expectTheme(page, 'dark');
  await expectReadable(page.getByRole('heading', { name: 'This page isn’t here.' }));
  await expectReadable(page.getByText('The address does not match a page in this demo.', { exact: false }));
  expect(consoleErrors).toEqual([]);
});

test('unmatched route remains readable after switching back to light mode', async ({ page, consoleErrors }) => {
  await page.goto('/unmatched/contrast');
  await expectTheme(page, 'light');
  await openNavigation(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expectTheme(page, 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expectTheme(page, 'light');
  await expectReadable(page.getByRole('heading', { name: 'This page isn’t here.' }));
  await expectReadable(page.getByText('The address does not match a page in this demo.', { exact: false }));
  expect(consoleErrors).toEqual([]);
});
