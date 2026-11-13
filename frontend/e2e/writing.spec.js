/** Follow browser-local publishing journeys with initial-load console capture. */
import { test, expect } from './fixtures.js';

const owner = { userId: 'synthetic-writer', username: 'synthetic', displayName: 'Synthetic writer', role: 'user' };
const original = { id: 'fixture-post', title: 'Synthetic notes', content: ' Original\n  writing ', createdAt: '2026-01-01', authorId: owner.userId, authorName: owner.displayName };

/** Seed synthetic real storage once, allowing reloads to observe actual persistence. */
async function seed(page, session = owner, posts = []) {
  await page.addInitScript(({ session, posts }) => {
    if (!localStorage.getItem('writing-fixture')) {
      localStorage.setItem('writespace_session', JSON.stringify(session));
      localStorage.setItem('writespace_posts', JSON.stringify(posts));
      localStorage.setItem('writing-fixture', 'ready');
    }
  }, { session, posts });
}
/** Activate the existing responsive Write navigation. */
async function writeLink(page) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await page.getByRole('link', { name: 'Write', exact: true }).click();
}

for (const role of ['user', 'admin']) {
  test(role + ' publishes, reloads, edits, cancels and deletes persisted writing', async ({ page, consoleErrors }) => {
    const session = { ...owner, role };
    await seed(page, session);
    await page.goto('/');
    await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
    await page.getByRole('link', { name: 'Write your first post' }).click();
    await expect(page.getByRole('note')).toContainText('Do not use real passwords');
    await page.getByRole('button', { name: 'Publish Blog' }).click();
    await expect(page.getByText('This field is required.', { exact: true })).toHaveCount(2);
    const content = ' First line\n\n  <b>Plain text</b> ';
    await page.getByLabel('Title', { exact: true }).fill('Synthetic published writing');
    await page.getByLabel('Content', { exact: true }).fill(content);
    await expect(page.getByRole('status')).toHaveText(content.length + ' characters');
    expect(await page.getByLabel('Content', { exact: true }).evaluate((element) => getComputedStyle(element).minHeight)).toBe('256px');
    await page.getByRole('button', { name: 'Publish Blog' }).click();
    const [post] = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
    expect(post).toMatchObject({ title: 'Synthetic published writing', content, authorId: session.userId, authorName: session.displayName });
    await expect(page).toHaveURL('/blog/' + post.id);
    await page.reload();
    expect(await page.getByLabel('Post content').textContent()).toBe(content);
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(page.getByLabel('Content', { exact: true })).toHaveValue(content);
    await page.getByLabel('Title', { exact: true }).fill('Revised writing');
    await page.getByLabel('Content', { exact: true }).fill('Revised local text');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    const revised = { ...post, title: 'Revised writing', content: 'Revised local text' };
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([revised]);
    await page.reload();
    await expect(page.getByLabel('Post content')).toHaveText('Revised local text');
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Content', { exact: true }).fill('Discard this edit');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([revised]);
    await writeLink(page);
    await page.getByLabel('Title', { exact: true }).fill('Discard this new post');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL('/blogs');
    await page.getByRole('link', { name: 'Revised writing', exact: true }).click();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([revised]);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL('/blogs');
    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
}

test('admin edits another author without changing original identity', async ({ page }) => {
  await seed(page, { ...owner, userId: 'synthetic-admin', role: 'admin' }, [original]);
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await page.getByRole('link', { name: original.title, exact: true }).click();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Admin revision');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([{ ...original, title: 'Admin revision' }]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Admin revision' })).toBeVisible();
});

test('corruption and real storage quota failure retain input, allow retry and do not navigate', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await page.getByRole('link', { name: 'Write your first post' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Retained title');
  await page.getByLabel('Content', { exact: true }).fill('Retained content');
  await page.evaluate(() => localStorage.setItem('writespace_posts', '{corrupt'));
  await page.getByRole('button', { name: 'Publish Blog' }).click();
  await expect(page).toHaveURL('/write');
  await expect(page.getByRole('alert')).toContainText('cannot be read');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{corrupt');
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue('Retained content');
  // Exhaust actual origin storage, then submit a post larger than remaining capacity.
  const reachedQuota = await page.evaluate(() => {
    localStorage.setItem('writespace_posts', '[]');
    const block = 'x'.repeat(64 * 1024);
    for (let index = 0; index < 4096; index += 1) {
      try { localStorage.setItem('quota-fixture-' + index, block); }
      catch (error) { return error.name === 'QuotaExceededError'; }
    }
    return false;
  });
  expect(reachedQuota).toBe(true);
  const largeDraft = 'Synthetic quota text '.repeat(16000);
  await page.getByLabel('Content', { exact: true }).fill(largeDraft);
  await page.getByRole('button', { name: 'Publish Blog' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save');
  await expect(page).toHaveURL('/write');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Retained title');
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue(largeDraft);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('[]');
  await page.evaluate(() => {
    Object.keys(localStorage).filter((key) => key.startsWith('quota-fixture-')).forEach((key) => localStorage.removeItem(key));
  });
  await page.getByRole('button', { name: 'Publish Blog' }).click();
  await expect(page.getByLabel('Post content')).toHaveText(largeDraft.trim());
  await page.reload();
  expect(await page.getByLabel('Post content').textContent()).toBe(largeDraft);
});

test('cross-tab revisions and deletion refresh warnings without discarding unsaved edit text', async ({ page, context, consoleErrors }) => {
  await seed(page, owner, [original]);
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await page.getByRole('link', { name: original.title, exact: true }).click();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Content', { exact: true }).fill('Unsaved local draft');
  const other = await context.newPage();
  other.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  other.on('pageerror', (error) => consoleErrors.push(error.message));
  await other.goto('/');
  await other.evaluate((post) => localStorage.setItem('writespace_posts', JSON.stringify([{ ...post, content: 'Remote revision' }])), original);
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue('Unsaved local draft');
  await other.evaluate(() => localStorage.setItem('writespace_posts', '{corrupt'));
  await expect(page.getByRole('alert')).toContainText('corrupt');
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue('Unsaved local draft');
  await other.evaluate(() => localStorage.setItem('writespace_posts', '[]'));
  await expect(page.getByRole('alert')).toContainText('Post not found');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page).toHaveURL('/edit/' + original.id);
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue('Unsaved local draft');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL('/blogs');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('[]');
  await other.close();
});
