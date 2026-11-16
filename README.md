# WriteSpace

WriteSpace is a browser-local writing demonstration. Visitors can discover posts and register, writers can read and maintain their own plain-text posts, and demo administrators can manage all posts and eligible local accounts. There is no backend, API, shared database, synchronization, password recovery or server-side authentication.

## Important limitations

**Do not use real passwords or sensitive content.** Account passwords are stored in plaintext in the browser, the built-in `admin` / `admin` credential is public, and client-side role and ownership checks are not security controls. Anyone with access to the browser profile, devtools, extensions or same-origin scripts can inspect or change this data. Use synthetic data only.

Data is scoped to the browser profile and exact origin (scheme, host and port). Clearing site data, private browsing, changing origins or losing a device may lose access; there is no product backup or recovery. Concurrent tabs can overwrite each other's changes because read-modify-write is not transactional. A storage event refreshes views but does not prevent lost updates. Keep a separate copy of important writing.

The application distinguishes missing storage from corrupt or unavailable collections. Missing keys are treated as empty; unreadable data blocks changes rather than being overwritten. Failed saves retain form input where possible. If registration saves an account but cannot save its session, sign in later after restoring storage; do not repeatedly register the same username. Clearing site data is destructive.

## Appearance and editor

Use the navigation theme control to switch between light and dark. The preference is saved locally as `writespace_theme` and remains after logout; if browser storage rejects the write, the selection applies only to the current tab and a warning is displayed. Missing or invalid preferences default to light. The editor displays the current content length in JavaScript UTF-16 code units; it does not limit or store the count.

## Local development

Requires Node.js 20 or later and npm. The application lives in `frontend/`.

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite. Configuration defaults work without an environment file; copy `.env.example` to `.env` only if overrides are needed. The file documents local host and port settings and contains no secrets. Never commit `.env`.

## Verify

```sh
cd frontend
npm test
npm run build
node node_modules/@playwright/test/cli.js install chromium
node node_modules/@playwright/test/cli.js test --workers=1
```

The test runner starts the production static test server. `node scripts/preflight.js` captures a text accessibility/HTML/style review and screenshots in `preflight-output/` when a built app is served at `PLAYWRIGHT_BASE_URL` (default `http://127.0.0.1:4173`). The integration tests use the local browser-storage implementation in jsdom. No application API tests apply. See the separately published test report for this run's actual results; E2E execution was blocked during this run and must be rerun in a working environment.

## Static delivery

```sh
docker build -t writespace ./frontend
docker run --rm -p 8080:80 writespace
```

The image builds the Vite assets and serves them via nginx. Root `/` is the health check; extensionless application routes fall back to the SPA shell and missing asset/file paths return 404. Fingerprinted assets get immutable cache headers; HTML is revalidated. The included Node server (`npm run preview`) is for local production-bundle verification, not an application data service.

The target design uses CloudFront → ALB → ECS with a stable HTTPS origin. A deployment must independently verify direct `/blogs`, `/blog/nonexistent`, `/edit/example`, `/admin`, root health, and a missing asset through CloudFront; verify TLS, network restrictions and IAM boundaries, retain a previous image, and rehearse rollback/cache invalidation. These deployment checks, runtime container validation and the proposed mobile performance baselines were not verified in this development run. Server-image rollback cannot restore browser data.
