import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import app from '../src/app.js';

let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health works without a database connection and is not cached', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).status, 'ok');
});

test('protected endpoint rejects missing and malformed tokens', async () => {
  for (const authorization of ['', 'Basic abc', 'Bearer']) {
    const response = await fetch(`${baseUrl}/api/auth/me`, { headers: { authorization } });
    assert.equal(response.status, 401);
  }
});

test('unknown endpoints return JSON 404 responses', async () => {
  const response = await fetch(`${baseUrl}/api/missing`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.message, 'Endpoint not found.');
});

test('malformed JSON returns 400 rather than an internal error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(response.status, 400);
});

test('unlisted browser origins are rejected', async () => {
  const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://unlisted.example' } });
  assert.equal(response.status, 403);
});
