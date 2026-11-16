/** Exercise the counter through real browser-local create and edit journeys. */
import { test, expect } from './fixtures.js';

test('counts create and edit input while cancel discards and save preserves writing', async ({ page, consoleErrors }) => {
  const session = { userId: 'counter-writer', username: 'counter', displayName: 'Counter writer', role: 'user' };
  await page.addInitScript((owner) => {
    if (!localStorage.getItem('counter-fixture')) {
      localStorage.setItem('writespace_session', JSON.stringify(owner));
      localStorage.setItem('writespace_posts', '[]');
      localStorage.setItem('counter-fixture', 'ready');
    }
  }, session);
  await page.goto('/write');
  const content = page.getByLabel('Content', { exact: true });
  const count = page.getByRole('status');
  await expect(content).toHaveValue('');
  await expect(count).toHaveText('0 characters');
  await expect(content).not.toHaveAttribute('maxlength');
  await content.fill('Discard 😀');
  await expect(count).toHaveText('10 characters');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL('/blogs');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);

  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL('/write');
  await expect(count).toHaveText('0 characters');
  await page.getByLabel('Title', { exact: true }).fill('Counter journey');
  await content.fill('Hello');
  await expect(count).toHaveText('5 characters');
  await content.press('Backspace');
  await expect(content).toHaveValue('Hell');
  await expect(count).toHaveText('4 characters');
  await content.press('End');
  await page.keyboard.insertText(' 😀\nwriting');
  const createdText = 'Hell 😀\nwriting';
  await expect(content).toHaveValue(createdText);
  await expect(count).toHaveText(`${createdText.length} characters`);
  await page.getByRole('button', { name: 'Publish Blog' }).click();
  const [post] = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(Object.keys(post).sort()).toEqual(['authorId', 'authorName', 'content', 'createdAt', 'id', 'title']);
  expect(post).toMatchObject({ title: 'Counter journey', content: createdText, authorId: session.userId, authorName: session.displayName });
  await expect(page).toHaveURL('/blog/' + post.id);
  await page.reload();
  expect(await page.getByLabel('Post content').textContent()).toBe(createdText);

  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(content).toHaveValue(createdText);
  await expect(count).toHaveText(`${createdText.length} characters`);
  await content.fill('Discard this edit 😀');
  await expect(count).toHaveText(`${'Discard this edit 😀'.length} characters`);
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([post]);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(content).toHaveValue(createdText);
  await expect(count).toHaveText(`${createdText.length} characters`);
  const revisedText = ' Revised 😀\n  text ';
  await content.fill(revisedText);
  await expect(count).toHaveText(`${revisedText.length} characters`);
  await page.getByRole('button', { name: 'Save Changes' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([{ ...post, content: revisedText }]);
  await page.reload();
  expect(await page.getByLabel('Post content').textContent()).toBe(revisedText);
  expect(consoleErrors).toEqual([]);
});
