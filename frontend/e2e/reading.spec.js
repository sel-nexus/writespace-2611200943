/** Follow real local-storage feed/reader journeys with automatic initial-load console capture. */
import { test, expect } from './fixtures.js';

const posts = [
  { id: 'old', title: 'Older notes', content: 'x'.repeat(130), createdAt: '2024-01-01', authorId: 'u1', authorName: 'Mira' },
  { id: 'new', title: '<b>Newest notes</b>', content: ' First line\n\n  Second line <script>plain text</script>', createdAt: '2026-06-01', authorId: 'u1', authorName: 'Mira' },
  { id: 'invalid', title: 'Undated notes', content: 'Preserve this record', createdAt: 'bad', authorId: 'u2', authorName: 'Other writer' },
];
for (const role of ['owner', 'other', 'admin']) {
  test(role + ' reads feed and reader with correct actions and confirmed persistence', async ({ page, consoleErrors }) => {
    const session = { userId: role === 'owner' ? 'u1' : 'u2', username: 'synthetic', displayName: 'Synthetic writer', role: role === 'admin' ? 'admin' : 'user' };
    // Seed once: reload must observe actual persisted deletion, not reseed records.
    await page.addInitScript(({ posts, session }) => {
      if (!localStorage.getItem('reading-fixture')) {
        localStorage.setItem('writespace_posts', JSON.stringify(posts));
        localStorage.setItem('writespace_session', JSON.stringify(session));
        localStorage.setItem('reading-fixture', 'ready');
      }
    }, { posts, session });
    await page.goto('/');
    await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
    await expect(page).toHaveURL('/blogs');
    const feed = page.getByLabel('Blog feed');
    await expect(feed.getByRole('heading', { level: 2 })).toHaveText(['<b>Newest notes</b>', 'Older notes', 'Undated notes']);
    await expect(feed.getByText('x'.repeat(120), { exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
    await feed.getByRole('link', { name: '<b>Newest notes</b>', exact: true }).click();
    await expect(page).toHaveURL('/blog/new');
    expect(await page.getByLabel('Post content').textContent()).toBe(posts[1].content);
    await expect(page.locator('main script, main b')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(role === 'other' ? 0 : 1);
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(role === 'other' ? 0 : 1);
    if (role !== 'other') {
      page.once('dialog', (dialog) => dialog.dismiss());
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page).toHaveURL('/blog/new');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page).toHaveURL('/blogs');
      const remaining = posts.filter((post) => post.id !== 'new');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(remaining);
      await page.reload();
      await expect(page.getByLabel('Blog feed').getByRole('heading', { level: 2 })).toHaveText(['Older notes', 'Undated notes']);
    } else {
      await page.getByRole('link', { name: 'Back to blogs' }).click();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
    }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
    expect(consoleErrors).toEqual([]);
  });
}
test('direct missing reader recovers to empty feed and cross-tab data refreshes both views', async ({ page, context, consoleErrors }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('writespace_session')) localStorage.setItem('writespace_session', JSON.stringify({ userId: 'u1', username: 'synthetic', displayName: 'Mira', role: 'user' }));
  });
  await page.goto('/blog/missing');
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  await expect(page.getByRole('status')).toContainText('No posts yet');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBeNull();
  const other = await context.newPage();
  const errors = [];
  other.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  other.on('pageerror', (error) => errors.push(error.message));
  await other.goto('/');
  await other.evaluate((posts) => localStorage.setItem('writespace_posts', JSON.stringify(posts)), posts);
  await page.getByRole('link', { name: '<b>Newest notes</b>', exact: true }).click();
  await other.evaluate(() => localStorage.setItem('writespace_posts', '{corrupt'));
  await expect(page.getByRole('alert')).toContainText('corrupt');
  await page.getByRole('button', { name: 'Retry loading posts' }).click();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{corrupt');
  await other.evaluate(() => localStorage.setItem('writespace_posts', '[]'));
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  await expect(page.getByRole('status')).toContainText('No posts yet');
  expect(errors).toEqual([]);
  await other.close();
  expect(consoleErrors).toEqual([]);
});
