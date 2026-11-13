/** Reset browser state and DOM between independently exercised component cases. */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { beforeEach, afterEach, vi } from 'vitest';

/** Restore the empty browser baseline before each test supplies its own data. */
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

/** Remove rendered trees before restoring mocks and browser state. */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});
