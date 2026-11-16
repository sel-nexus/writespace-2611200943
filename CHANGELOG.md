# Changelog

## Current brownfield change

- Added a shared accessible light/dark toggle to public and signed-in navigation. `App.jsx` owns theme state, applies the root class and saves the raw `writespace_theme` value; unavailable storage leaves the current selection active and displays a warning. Missing or invalid values default to light, and logout preserves the preference.
- Enabled Tailwind class-based dark mode and extended public, authentication, post, editor, dashboard and account-management surfaces with dark variants while preserving existing layout and actions.
- Retained the existing informational editor counter and added tests for UTF-16 counting, create/edit, input changes, long content and unchanged persisted records. There is no length limit or stored count.
- Added theme/counter browser specifications and component regressions; improved dark shell and logout-error contrast and corrected existing browser expectations for the new theme key. `frontend/scripts/theme-preflight.js` captures desktop/mobile accessibility, styles, HTML and screenshots.
- Updated `README.md` with preference and counter behavior. Existing post, user and session record shapes and routes are unchanged; no data migration is required. Older deployments ignore the new theme key. No backend or shared database was introduced.

### Verification and limits

The baseline passed 375 tests; the revised suite passed 401 tests and the Vite production build succeeded. Independent test review passed. A desktop/mobile light/dark browser preflight ran. The full Playwright suite and a focused retry timed out without output; the human approved proceeding with E2E unverified. A storage-denial test injects an exception and does not establish actual browser denial. Deployed AWS CloudFront routing, infrastructure security and performance remain unverified.
