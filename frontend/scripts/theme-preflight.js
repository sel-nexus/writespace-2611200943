/** Capture representative light and dark browser views for review. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'preflight-output';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [name, viewport] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173');
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') {
        if (name === 'mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click();
        await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      }
      const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
      const styles = await page.evaluate(() => ({
        bodyFont: getComputedStyle(document.body).fontFamily,
        bodyColor: getComputedStyle(document.body).color,
        mainBackground: getComputedStyle(document.querySelector('main')).backgroundColor,
        viewport: [innerWidth, innerHeight],
        documentWidth: document.documentElement.scrollWidth,
      }));
      await page.screenshot({ path: `${output}/${name}-${mode}-theme.png`, fullPage: true });
      results.push(`## ${name} ${mode}\nStyles: ${JSON.stringify(styles)}\nAccessibility: ${JSON.stringify(accessibility, null, 2)}\nHTML:\n${await page.content()}\n`);
    }
    await page.close();
  }
  await writeFile(`${output}/theme-review.txt`, results.join('\n'));
} finally {
  await browser.close();
}
