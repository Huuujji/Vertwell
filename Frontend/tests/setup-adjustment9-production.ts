import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Exercise real hashed production chunks against test-owned Auth/API/SQL only.
// Ignore local configuration, environment files and the development API proxy.
export default async function setupProductionServer() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const outDir = fileURLToPath(new URL('../../../memory/backend/supabase/major-adjustments-evidence/2026-10-27-adjustment9/compiled-frontend', import.meta.url));
  await build({ root, configFile: false, envDir: false, plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': '"https://management.test"',
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '"test-publishable"',
      'import.meta.env.VITE_API_BASE_URL': '""',
    },
    build: { outDir, emptyOutDir: true },
  });
  const server = await preview({ root, configFile: false, envDir: false, build: { outDir },
    plugins: [{ name: 'reject-unrouted-production-test-api', configurePreviewServer(server) {
      server.middlewares.use('/api', (_request, response) => {
        response.statusCode = 503;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ error: { message: 'No disposable test transport handled this API request.' } }));
      });
    } }],
    preview: { host: '127.0.0.1', port: 5180, strictPort: true, open: false },
  });
  return () => new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
