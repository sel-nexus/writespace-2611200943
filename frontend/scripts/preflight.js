/** Capture representative production UI structure and screenshots for review. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
const output = 'preflight-output';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [name, viewport] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(origin);
    await page.getByRole('heading', { name: /Your thoughts\. Your space/ }).waitFor();
    for (const state of ['landing', 'login', 'validation']) {
      if (state === 'login') await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
      if (state === 'validation') await page.getByRole('button', { name: 'Log in', exact: true }).click();
      const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
      const styles = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const heading = document.querySelector('h1');
        const h = heading ? getComputedStyle(heading) : null;
        return { font: body.fontFamily, color: body.color, background: body.backgroundColor,
          headingFont: h?.fontFamily, headingSize: h?.fontSize, headingLineHeight: h?.lineHeight,
          viewport: [innerWidth, innerHeight], documentWidth: document.documentElement.scrollWidth };
      });
      await page.screenshot({ path: `${output}/${name}-${state}.png`, fullPage: true });
      results.push(`## ${name} ${state}\nStyles: ${JSON.stringify(styles)}\nAccessibility: ${JSON.stringify(accessibility, null, 2)}\nHTML:\n${await page.content()}\n`);
    }
    await context.close();
  }
  await writeFile(`${output}/review.txt`, results.join('\n'));
} finally {
  await browser.close();
}
