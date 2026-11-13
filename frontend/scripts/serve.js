/** Serve only the production bundle with SPA routes and real missing-asset 404s. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(projectRoot, '.env') });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Validate the listener settings before binding a local static server.
 *
 * Args:
 *   env: Supply host and port overrides from the execution environment.
 * Returns:
 *   A host and validated TCP port using documented demo defaults.
 * Raises:
 *   Error: If the port is invalid.
 */
export function serverSettings(env = process.env) {
  const port = Number(env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return { host: env.HOST || '127.0.0.1', port };
}

/**
 * Read a regular static file while distinguishing missing paths from I/O failures.
 *
 * Args:
 *   filename: Identify a resolved file inside the bundle.
 * Returns:
 *   File bytes, or null when the path is missing or not a regular file.
 * Raises:
 *   Error: If a present file cannot be read.
 */
async function readStaticFile(filename) {
  try {
    const info = await stat(filename);
    return info.isFile() ? await readFile(filename) : null;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return null;
    }
    throw error;
  }
}

/**
 * Finish an HTTP response without sending a body for HEAD requests.
 *
 * Args:
 *   request: Determine whether the client requested only headers.
 *   response: Receive the status, headers, and optional bytes.
 *   status: Identify the HTTP result.
 *   body: Supply the response bytes or explanation.
 *   headers: Supply the content and cache policy.
 */
function send(request, response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

/**
 * Create a plain HTTP listener that serves bundle files, never an application API.
 *
 * Args:
 *   distRoot: Identify the built static directory; default to this project's dist.
 * Returns:
 *   An unbound server suitable for the CLI or isolated serving checks.
 * Notes:
 *   Missing extension-bearing paths and anything under assets return 404.
 *   Extensionless client routes fall back to the revalidated HTML shell.
 */
export function createStaticServer(distRoot = resolve(projectRoot, 'dist')) {
  const root = resolve(distRoot);

  /** Serve a safe static path or an extensionless client-side route. */
  async function handleRequest(request, response) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(request, response, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://static.invalid').pathname);
    } catch {
      send(request, response, 400, 'Invalid path');
      return;
    }

    const filename = resolve(root, `.${pathname}`);
    const segments = pathname.split('/');
    if (
      pathname.includes('\0') || pathname.includes('\\') ||
      segments.some((segment) => segment.startsWith('.')) ||
      (filename !== root && !filename.startsWith(`${root}${sep}`))
    ) {
      send(request, response, 404, 'Not found');
      return;
    }

    try {
      let file = pathname === '/' ? resolve(root, 'index.html') : filename;
      let body = await readStaticFile(file);
      const assetRequest = pathname === '/assets' || pathname.startsWith('/assets/');
      if (body === null && !assetRequest && !extname(pathname)) {
        file = resolve(root, 'index.html');
        body = await readStaticFile(file);
      }
      if (body === null) {
        send(request, response, 404, 'Not found');
        return;
      }

      const extension = extname(file).toLowerCase();
      send(request, response, 200, body, {
        'Content-Type': mimeTypes[extension] || 'application/octet-stream',
        'Cache-Control': assetRequest && extension !== '.html'
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
        'Content-Length': body.length,
      });
    } catch (error) {
      console.error('Static file serving failed:', error.message);
      send(request, response, 500, 'Unable to serve the static bundle');
    }
  }

  return createServer(handleRequest);
}

/** Bind the configured listener and fail visibly on startup errors. */
function startServer() {
  const { host, port } = serverSettings();
  const server = createStaticServer();
  server.on('error', (error) => {
    console.error('Static server failed:', error.message);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`Serving production dist at http://${host}:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startServer();
}
