import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';

// A read-only operator command. It never exchanges a password, makes a sale,
// changes configuration or probes a caller-supplied arbitrary URL by default.
const local = await readFile(new URL('../.env.operations.local', import.meta.url), 'utf8').catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ENOENT') return ''; throw new Error('Cannot read private operational settings.');
});
const settings = { ...parse(local), ...process.env };
const target = new URL(settings.VERTWELL_OPS_BASE_URL ?? 'http://127.0.0.1:3001');
const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname);
if (target.username || target.password || target.search || target.hash || target.pathname !== '/' || !['http:', 'https:'].includes(target.protocol)) throw new Error('Use an origin without credentials, path, query or fragment.');
if (!loopback && (target.protocol !== 'https:' || !process.argv.includes('--allow-hosted') || settings.VERTWELL_OPS_EXPECTED_ORIGIN !== target.origin)) {
  throw new Error('Hosted checks require HTTPS, --allow-hosted and an exact VERTWELL_OPS_EXPECTED_ORIGIN. No request made.');
}
const output: Record<string, unknown> = { checkedAt: new Date().toISOString(), origin: target.origin, scope: 'dependency-check-only' };
try {
  const alive = await fetch(new URL('/api/health', target), { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const body = await alive.json();
  output.liveness = alive.ok && body.status === 'ok' && body.service === 'vertwell-api' ? 'passed' : 'failed';
  if (!settings.VERTWELL_OPS_ACCESS_TOKEN) {
    output.ownerProbe = 'not-run'; output.action = 'Supply a current Owner access token privately; never put it in source, command arguments or chat.';
    process.exitCode = 2;
  } else {
    const ready = await fetch(new URL('/api/health/ready', target), { headers: { Authorization: `Bearer ${settings.VERTWELL_OPS_ACCESS_TOKEN}` },
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const result = await ready.json();
    output.requestId = ready.headers.get('x-request-id'); output.httpStatus = ready.status;
    const checks = result?.checks;
    const valid = result?.scope === 'read-only-dependency-probe' && ['passed', 'unavailable'].includes(checks?.database) && ['passed', 'unavailable'].includes(checks?.storage);
    if (valid) output.checks = { authentication: checks.authentication === 'passed' ? 'passed' : 'unavailable', database: checks.database,
      storage: checks.storage, privateUpdates: 'requires-client-observation', checkoutReconciliation: 'requires-receipt-review' };
    output.ownerProbe = ready.ok && result.status === 'ok' && valid && checks.authentication === 'passed' && checks.database === 'passed' && checks.storage === 'passed' ? 'passed' : 'failed';
    if (ready.status === 401) output.action = 'Refresh the private Owner session token; do not treat an expired probe credential as a database outage.';
    else if (ready.status === 403) output.action = 'Use a current active Owner; do not widen account permissions.';
    else if (!ready.ok) output.action = 'Follow OPERATIONS.md using the request ID and time; do not automatically retry a business command.';
    if (output.liveness !== 'passed' || output.ownerProbe !== 'passed') process.exitCode = 1;
  }
} catch {
  output.probe = 'unavailable'; output.action = 'Check API/network availability and follow OPERATIONS.md. No business command was sent.'; process.exitCode = 1;
}
console.log(JSON.stringify(output, null, 2));
