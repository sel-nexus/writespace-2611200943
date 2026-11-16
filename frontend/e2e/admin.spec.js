/** Follow click-driven admin journeys with actual storage and automatic console capture. */
import { test, expect } from './fixtures.js';

const users = [
  { id: 'local-admin', displayName: 'Local admin', username: 'local-admin', password: 'demo-only', role: 'admin', createdAt: '2026-01-01' },
  { id: 'writer', displayName: 'Synthetic writer', username: 'writer', password: 'demo-only', role: 'user', createdAt: '2026-01-01' },
];
const posts = Array.from({ length: 6 }, (_, i) => ({ id: 'post-' + i, title: 'Synthetic post ' + i,
  content: 'Historical writing', authorId: 'writer', authorName: 'Synthetic writer', createdAt: '2026-01-0' + (i + 1) }));
/** Seed once so reload assertions observe saved changes rather than fixture resets. */
async function seed(page) {
  await page.addInitScript(({ users, posts }) => {
    if (!localStorage.getItem('admin-fixture')) {
      localStorage.setItem('writespace_users', JSON.stringify(users));
      localStorage.setItem('writespace_posts', JSON.stringify(posts));
      localStorage.setItem('admin-fixture', 'ready');
    }
  }, { users, posts });
}
/** Reveal navigation when needed, then activate its native link. */
async function nav(page, name) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true }).click();
}
/** Begin at discovery and sign in using the actual login form. */
async function signIn(page, username = 'admin', password = 'admin') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL('/admin');
}
/** Fill the small admin form without invoking registration. */
async function createFields(page, username, role) {
  await page.getByLabel('Display name', { exact: true }).fill('Synthetic ' + username);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Role', { exact: true }).selectOption(role);
}
/** Locate the accessible desktop row or mobile card; hidden layouts are excluded by role. */
function deleteAccount(page, username) {
  return page.getByRole('button', { name: 'Delete ' + username, exact: true });
}

test('fixed admin overview, both quick links, arbitrary edit and confirmed post deletion', async ({ page }) => {
  await seed(page); await signIn(page);
  for (const [label, count] of [['Total Posts', 6], ['Total Users', 3], ['Total Admins', 2], ['Total Registered Users', 1]]) {
    await expect(page.getByLabel(label, { exact: true })).toContainText(String(count));
  }
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  await expect(recent.getByRole('link', { name: /^Synthetic post/ })).toHaveText(['Synthetic post 5', 'Synthetic post 4', 'Synthetic post 3', 'Synthetic post 2', 'Synthetic post 1']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await expect(page).toHaveURL('/write');
  await page.getByLabel('Title', { exact: true }).fill('Discarded admin draft');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await nav(page, 'Home');
  await page.getByRole('link', { name: 'Edit Synthetic post 5' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Admin revision');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  const revised = posts.map((post) => post.id === 'post-5' ? { ...post, title: 'Admin revision' } : post);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(revised);
  await nav(page, 'Home');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Admin revision' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(revised);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Admin revision' }).click();
  await expect(page).toHaveURL('/blogs');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts.slice(0, 5));
  await nav(page, 'Home');
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await expect(page).toHaveURL('/users');
  await expect(deleteAccount(page, 'admin')).toBeDisabled();
  await expect(deleteAccount(page, 'admin')).toHaveAttribute('title', 'Default admin cannot be deleted.');
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts.slice(0, 5));
});

test('stored admin protects self, creates both roles, rejects duplicate and retains historical posts on removal', async ({ page }) => {
  await seed(page); await signIn(page, 'local-admin', 'demo-only');
  const session = await page.evaluate(() => localStorage.getItem('writespace_session'));
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await expect(deleteAccount(page, 'local-admin')).toBeDisabled();
  await expect(deleteAccount(page, 'admin')).toBeDisabled();
  for (const role of ['admin', 'user']) {
    await createFields(page, 'new-' + role, role);
    await page.getByRole('button', { name: 'Create User' }).click();
    await expect(page.getByRole('status')).toContainText('Account created');
  }
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(saved).toHaveLength(4);
  expect(saved.slice(2).map((user) => user.role)).toEqual(['admin', 'user']);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe(session);
  await createFields(page, 'new-user', 'user');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(saved);
  page.once('dialog', (dialog) => dialog.dismiss());
  await deleteAccount(page, 'writer').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(saved);
  page.once('dialog', (dialog) => dialog.accept());
  await deleteAccount(page, 'writer').click();
  await expect(page.getByRole('status')).toContainText('Historical posts were kept');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(saved.filter((user) => user.id !== 'writer'));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  await page.reload();
  await expect(deleteAccount(page, 'writer')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(page.getByLabel('Total Users', { exact: true })).toContainText('4');
  await expect(page.getByLabel('Total Admins', { exact: true })).toContainText('3');
  await expect(page.getByLabel('Total Registered Users', { exact: true })).toContainText('1');
});

test('cross-tab unreadable accounts preserve draft and corrupt bytes, then refresh on recovery', async ({ page, context, consoleErrors }) => {
  await seed(page); await signIn(page);
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await createFields(page, 'retained', 'admin');
  const other = await context.newPage();
  other.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  other.on('pageerror', (error) => consoleErrors.push(error.message));
  await other.goto('/');
  await other.evaluate(() => localStorage.setItem('writespace_users', '{corrupt'));
  await expect(page.getByText(/Accounts unavailable: corrupt/)).toBeVisible();
  await page.getByRole('button', { name: 'Create User' }).click();
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe('{corrupt');
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('retained');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('demo-only');
  await other.evaluate((users) => localStorage.setItem('writespace_users', JSON.stringify(users)), users);
  await expect(deleteAccount(page, 'writer')).toBeVisible();
  await page.getByRole('button', { name: 'Create User' }).click();
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).at(-1)).toMatchObject({ username: 'retained', role: 'admin' });
  await other.close();
});

test('dark admin workflow keeps metrics, forms and account controls readable and functional', async ({ page }) => {
  await seed(page); await signIn(page, 'local-admin', 'demo-only');
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  const metric = page.getByLabel('Total Users', { exact: true });
  await expect(metric).toContainText('3');
  await expect(metric).toHaveCSS('background-color', 'rgb(30, 41, 59)');
  await expect(page.getByText(/Synthetic writer ·/).first()).toHaveCSS('color', 'rgb(203, 213, 225)');
  await page.getByRole('link', { name: 'Manage Users', exact: true }).click();
  await expect(deleteAccount(page, 'admin')).toBeDisabled();
  await expect(deleteAccount(page, 'local-admin')).toBeDisabled();
  await expect(deleteAccount(page, 'writer')).toHaveCSS('color', 'rgb(252, 165, 165)');
  const username = page.getByLabel('Username', { exact: true });
  await expect(username).toHaveCSS('background-color', 'rgb(30, 41, 59)');
  await expect(username).toHaveCSS('color', 'rgb(241, 245, 249)');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(username).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#username-error')).toHaveCSS('color', 'rgb(252, 165, 165)');
  await createFields(page, 'dark-writer', 'user');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByRole('status')).toContainText('Account created');
  await expect(deleteAccount(page, 'dark-writer')).toBeEnabled();
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(deleteAccount(page, 'dark-writer')).toBeEnabled();
  page.once('dialog', (dialog) => dialog.accept());
  await deleteAccount(page, 'dark-writer').click();
  await expect(deleteAccount(page, 'dark-writer')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(users);
  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(page.getByLabel('Total Users', { exact: true })).toContainText('3');
  await expect(page.getByRole('note', { name: 'Browser-local demo — not secure authentication' })).toBeVisible();
});
