/** Configure the static build and dotenv-backed development listener. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Resolve development settings without exposing unprefixed values to the client.
 *
 * Args:
 *   mode: Select the environment file family Vite loads.
 * Returns:
 *   A React build configuration with a strict development port.
 * Raises:
 *   Error: If the configured port cannot identify a TCP listener.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_PORT || 5173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('VITE_PORT must be an integer between 1 and 65535.');
  }

  return {
    plugins: [react()],
    server: {
      host: env.VITE_HOST || '127.0.0.1',
      port,
      strictPort: true,
    },
  };
});
