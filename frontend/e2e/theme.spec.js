/** Exercise keyboard theme selection, reload and logout on desktop and mobile. */
import { test, expect } from './fixtures.js';

/** Reveal the responsive navigation when necessary. */
async function openNavigation(page) {
  const menu = page.getByRole('button', { name: 'Toggle navigation' });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
}

/** Compare computed text color against the composited solid ancestor backgrounds. */
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

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`theme survives reload and logout at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await openNavigation(page);
    const dark = page.getByRole('button', { name: 'Switch to dark mode' });
    await dark.focus();
    await expect(dark).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await openNavigation(page);
    await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('admin');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL('/admin');
    await openNavigation(page);
    const light = page.getByRole('button', { name: 'Switch to light mode' });
    await light.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await page.getByRole('button', { name: /Administrator/ }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL('/');
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('writespace_theme'))).toBe('dark');
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test(`failed logout is readable in dark mode at ${viewport.width}px`, async ({ page, consoleErrors }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await openNavigation(page);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('admin');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL('/admin');
    const session = await page.evaluate(() => localStorage.getItem('writespace_session'));
    expect(session).not.toBeNull();
    await page.evaluate(() => {
      const removeItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key) {
        if (this === window.localStorage && key === 'writespace_session') {
          throw new DOMException('Storage access denied', 'SecurityError');
        }
        return removeItem.call(this, key);
      };
    });
    await openNavigation(page);
    await page.getByRole('button', { name: /Administrator/ }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    const error = page.getByRole('alert');
    await expect(error).toHaveText('Could not sign out in this browser. Check site storage and try again.');
    await expectReadable(error);
    await expect(page).toHaveURL('/admin');
    await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBe(session);
    expect(consoleErrors).toEqual([]);
  });
}
