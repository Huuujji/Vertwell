import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Own Vite in the runner so cleanup closes it directly. Windows sandbox policies
// can prevent Playwright's taskkill /T subprocess from stopping a webServer tree.
export default async function setupServer() {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    // Do not inherit the development proxy or any local environment configuration.
    configFile: false,
    plugins: [react(), { name: 'reject-unrouted-test-api', configureServer(server) {
      server.middlewares.use('/api', (_request, response) => {
        response.statusCode = 503;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ error: { message: 'No disposable test transport handled this API request.' } }));
      });
    } }],
    optimizeDeps: { include: ['jspdf'] },
    // Regression requests use test-owned Auth/API transports. Never load the
    // developer's hosted credentials; no production preview is restored.
    envDir: false,
    define: { 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""', 'import.meta.env.VITE_API_BASE_URL': '""' },
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
