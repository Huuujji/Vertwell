import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// Own Vite in the runner so cleanup closes it directly. Windows sandbox policies
// can prevent Playwright's taskkill /T subprocess from stopping a webServer tree.
export default async function setupServer() {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    // Regression previews are credential-free even when local development Auth is configured.
    envDir: false,
    define: { 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""' },
    server: { host: '127.0.0.1', port: 5180, strictPort: true, open: false },
  });
  try {
    await server.listen();
  } catch (error) {
    await server.close();
    throw error;
  }
  return async () => { await server.close(); };
}
