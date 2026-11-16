/** Exercise keyboard theme selection, reload and logout on desktop and mobile. */
import { test, expect } from './fixtures.js';

/** Reveal the responsive navigation when necessary. */
async function openNavigation(page) {
  const menu = page.getByRole('button', { name: 'Toggle navigation' });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
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
}
