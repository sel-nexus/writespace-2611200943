/** Attach browser error listeners before each journey can navigate. */
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  consoleErrors: [
    /**
     * Collect errors before yielding the page to the test and fail after use.
     *
     * Args:
     *   page: Observe browser console and uncaught exceptions.
     *   use: Yield the shared error list for explicit journey assertions.
     * Notes:
     *   Automatic setup happens before navigation, including the first page load.
     */
    async ({ page }, use) => {
      const errors = [];
      /** Record console errors without ignoring initial-load failures. */
      const onConsole = (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      };
      /** Record exceptions that may not produce a console message. */
      const onPageError = (error) => errors.push(error.message);
      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      try {
        await use(errors);
        expect(errors, 'Browser console errors and uncaught exceptions').toEqual([]);
      } finally {
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
      }
    },
    { auto: true },
  ],
});

export { expect };
