/** Verify the production shell's warning, history navigation, and direct entry. */
import { test, expect } from './fixtures.js';

/**
 * Save a representative shell screenshot for human review, not visual assertions.
 *
 * Args:
 *   page: Capture the current browser view.
 *   testInfo: Attach evidence to the matching project and test result.
 *   name: Distinguish the current meaningful state.
 */
async function captureForHumanReview(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`${name} — human visual review requested`, {
    path,
    contentType: 'image/png',
  });
  testInfo.annotations.push({
    type: 'human-review',
    description: `Review ${name}.png for editorial hierarchy and responsive readability.`,
  });
}

/** Prove the first production load warns visitors and preserves preexisting bytes. */
test('home explains the demo and preserves browser storage', async ({ page, consoleErrors }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('shell-check', '{corrupt bytes preserved');
    sessionStorage.setItem('shell-session-check', 'keep this');
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A space for your words.');
  await expect(page.getByRole('note')).toContainText('not secure authentication');
  await expect(page.getByRole('note')).toContainText('Do not use real passwords');
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({
    'shell-check': '{corrupt bytes preserved',
  });
  expect(await page.evaluate(() => ({ ...sessionStorage }))).toEqual({
    'shell-session-check': 'keep this',
  });
  await captureForHumanReview(page, testInfo, 'shell-home');
  expect(consoleErrors).toEqual([]);
});

/** Prove unmatched direct entries survive reload and recover through browser history. */
test('direct unmatched entry recovers home and supports back and forward', async ({ page, consoleErrors }, testInfo) => {
  const response = await page.goto('/unmatched/direct-entry');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page isn’t here.');
  await expect(page.getByRole('note')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible();
  await captureForHumanReview(page, testInfo, 'shell-not-found');

  await page.getByRole('link', { name: 'Return home' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A space for your words.');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page isn’t here.');
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A space for your words.');
  expect(consoleErrors).toEqual([]);
});

/** Prove the home navigation works from a direct entry and missing assets are not HTML. */
test('home navigation and static asset policy work on production delivery', async ({ page, request, consoleErrors }) => {
  await page.goto('/another-unmatched-entry');
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A space for your words.');
  const shell = await request.get('/');
  expect(shell.headers()['cache-control']).toBe('no-cache');
  const missing = await request.get('/assets/missing.js');
  expect(missing.status()).toBe(404);
  expect(missing.headers()['content-type']).not.toContain('text/html');
  expect(consoleErrors).toEqual([]);
});
