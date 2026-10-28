import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AccountEmailMessage } from '../src/lib/email-delivery.js';
import { accountEmailTemplates } from '../src/lib/account-email-templates.generated.js';
import { renderAccountEmail } from '../src/lib/account-email-renderer.js';
import { createBrevoEmailDelivery, type BrevoEmailConfiguration } from '../src/lib/brevo-email-delivery.js';

// Never inherit real delivery configuration in this test process.
for (const key of ['BREVO_API_KEY', 'ACCOUNT_EMAIL_ORIGIN', 'ACCOUNT_EMAIL_FROM', 'ACCOUNT_EMAIL_REPLY_TO']) process.env[key] = '';
process.env.SUPABASE_URL = 'https://no-email.test';
process.env.SUPABASE_PUBLISHABLE_KEY = 'synthetic-public';
process.env.SUPABASE_SECRET_KEY = 'synthetic-private';

const configuration = { origin: 'https://account.test', apiKey: 'synthetic-brevo-key-only', fromEmail: 'sender@example.invalid', replyToEmail: 'reply@example.invalid' };
function message(purpose: 'verification' | 'recovery' = 'verification', code = '12345678'): AccountEmailMessage {
  const email = `fixture-${randomUUID()}@example.invalid`;
  const tokenHash = createHash('sha224').update(email + code).digest('hex');
  const linkProof = `${tokenHash}.${randomUUID()}`;
  return { email, purpose, code, tokenHash, linkProof, link: `${configuration.origin}/auth/${purpose === 'verification' ? 'verify' : 'recover'}#token_hash=${linkProof}` };
}

test('runtime bundle exactly preserves the reviewed template bodies and subjects', async () => {
  for (const [purpose, file, subject] of [
    ['verification', 'confirmation.html', 'HappyHentie — Verify your account email'],
    ['recovery', 'recovery.html', 'HappyHentie — Recover your password'],
  ] as const) {
    assert.equal(accountEmailTemplates[purpose].html, (await readFile(new URL(`../supabase/templates/${file}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n'));
    assert.equal(accountEmailTemplates[purpose].subject, subject);
  }
});

test('missing or invalid configuration cannot install a sender or make a request', () => {
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; throw new Error('Forbidden request'); };
  for (const key of Object.keys(configuration) as (keyof BrevoEmailConfiguration)[]) {
    assert.equal(createBrevoEmailDelivery({ ...configuration, [key]: '' }, transport), undefined);
    assert.equal(createBrevoEmailDelivery({ ...configuration, [key]: undefined }, transport), undefined);
  }
  for (const origin of ['http://account.test', 'https://user:pass@account.test', 'https://account.test/path', 'https://account.test/?x=1',
    'https://account.test/#proof', 'https://account.test/#', 'https://account.test/?', 'https://account.test/\n', 'https://account.test.evil/path', 'https://a"b.test', 'invalid']) {
    assert.equal(createBrevoEmailDelivery({ ...configuration, origin }, transport), undefined);
  }
  for (const apiKey of ['', 'key\r\nInjected: yes', 'key\n', 'key with spaces', 'x'.repeat(1025)]) {
    assert.equal(createBrevoEmailDelivery({ ...configuration, apiKey }, transport), undefined);
  }
  for (const key of ['fromEmail', 'replyToEmail'] as const) for (const address of ['a@example.invalid\n', 'a@example.invalid\r\nBcc: other@example.invalid', 'a@example.invalid,b@example.invalid', '<a@example.invalid>', 'a@localhost']) {
    assert.equal(createBrevoEmailDelivery({ ...configuration, [key]: address }, transport), undefined);
  }
  assert.equal(calls, 0);
});

for (const purpose of ['verification', 'recovery'] as const) for (const code of ['123456', '12345678']) {
  test(`Brevo ${purpose} ${code.length}-digit message uses the exact app proof and safe fixed envelope`, async () => {
    const m = message(purpose, code);
    let calls = 0;
    const sender = createBrevoEmailDelivery(configuration, async (input, init) => {
      calls++;
      assert.equal(String(input), 'https://api.brevo.com/v3/smtp/email');
      assert.equal(init?.method, 'POST'); assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store'); assert.equal(init?.credentials, 'omit');
      assert.ok(init?.signal); assert.equal(init.signal.aborted, false);
      const headers = new Headers(init.headers);
      assert.equal(headers.get('api-key'), configuration.apiKey);
      assert.equal(headers.get('authorization'), null); assert.equal(headers.get('cookie'), null);
      assert.equal(headers.get('content-type'), 'application/json');
      const body = JSON.parse(String(init.body));
      assert.deepEqual(Object.keys(body).sort(), ['htmlContent', 'replyTo', 'sender', 'subject', 'to']);
      assert.deepEqual(body.sender, { name: 'HappyHentie', email: configuration.fromEmail });
      assert.deepEqual(body.to, [{ email: m.email }]); assert.deepEqual(body.replyTo, { email: configuration.replyToEmail });
      assert.equal(body.subject, accountEmailTemplates[purpose].subject);
      assert.ok(body.htmlContent.includes(`>${m.code}</p>`)); assert.ok(body.htmlContent.includes(`href="${m.link}"`));
      assert.ok(body.htmlContent.includes(`src="${configuration.origin}/assets/be809.png"`));
      assert.ok(body.htmlContent.includes('HappyHentie Café and Hobby Shop'));
      assert.ok(!body.htmlContent.includes('{{')); assert.ok(!String(init.body).includes(configuration.apiKey));
      assert.ok(!String(init.body).includes('Injected'));
      return Response.json({ messageId: '<synthetic-only@brevo.test>' }, { status: 201 });
    });
    assert.ok(sender);
    assert.equal(await sender.send({ ...m, subject: 'Injected', sender: 'Injected' } as AccountEmailMessage), 'accepted');
    assert.equal(calls, 1);
  });
}

test('malformed, injected, wrong-purpose and mismatched credentials are rejected before submission', async () => {
  let calls = 0;
  const sender = createBrevoEmailDelivery(configuration, async () => { calls++; throw new Error('Forbidden request'); })!;
  const m = message();
  for (const change of [
    { email: 'other@example.invalid' }, { email: 'a@example.invalid\r\nBcc: other@example.invalid' },
    { code: '<img src=x onerror=alert(1)>' }, { code: '123456789' }, { code: '1234567\n' },
    { purpose: 'recovery' }, { purpose: '__proto__' }, { tokenHash: '0'.repeat(56) },
    { linkProof: m.tokenHash }, { linkProof: m.linkProof.replace(/.$/, 'x') },
    { link: `https://evil.test/auth/verify#token_hash=${m.linkProof}` },
    { link: m.link.replace('/auth/verify', '/auth/recover') }, { link: m.link.replace('#', '?') },
    { link: m.link + '&redirect=https://evil.test' }, { link: 'javascript:alert(1)' },
    { link: `${m.link}" onclick="alert(1)` },
  ]) {
    const bad = { ...m, ...change } as AccountEmailMessage;
    assert.throws(() => renderAccountEmail(bad, configuration.origin), /content is invalid/);
    assert.equal(await sender.send(bad), 'rejected');
  }
  // A final newline must fail even when its hash/link are internally consistent;
  // JavaScript's $ anchor alone can otherwise match before that newline.
  assert.equal(await sender.send(message('verification', '123456\n')), 'rejected');
  assert.equal(calls, 0);
});

test('definitive HTTP rejections return rejected without exposing provider content or retrying', async () => {
  for (const status of [400, 401, 403, 404, 405, 413, 415, 422, 429]) {
    let calls = 0;
    const sender = createBrevoEmailDelivery(configuration, async () => {
      calls++; return new Response(configuration.apiKey + ' private provider diagnostics', { status });
    })!;
    assert.equal(await sender.send(message()), 'rejected'); assert.equal(calls, 1);
  }
});

test('uncertain statuses, redirects and malformed success never cancel proof or report acceptance', async () => {
  for (const status of [200, 202, 204, 301, 302, 307, 308, 402, 408, 409, 425, 500, 502, 503]) {
    let calls = 0;
    const sender = createBrevoEmailDelivery(configuration, async () => {
      calls++; return new Response(null, { status });
    })!;
    await assert.rejects(sender.send(message()), { message: 'Email delivery could not be confirmed.' }); assert.equal(calls, 1);
  }
  for (const body of ['not JSON', 'null', '[]', '{}', '{"messageId":""}', '{"messageId":"contains space"}',
    '{"messageId":"line\\nfeed"}', JSON.stringify({ messageId: 'trailing\n' }), JSON.stringify({ messageId: 'x'.repeat(257) }), 'x'.repeat(4097)]) {
    const sender = createBrevoEmailDelivery(configuration, async () => new Response(body, { status: 201 }))!;
    await assert.rejects(sender.send(message()), { message: 'Email delivery could not be confirmed.' });
  }
});

test('lost transport response is sanitized and never retried', async () => {
  const m = message(); let calls = 0;
  const sender = createBrevoEmailDelivery(configuration, async () => {
    calls++; throw new Error(configuration.apiKey + m.code + m.link + ' private network diagnostics');
  })!;
  await assert.rejects(sender.send(m), { message: 'Email delivery could not be confirmed.' }); assert.equal(calls, 1);
});

for (const phase of ['connection', 'acknowledgement'] as const) test(`${phase} is bounded and aborted without another send`, async () => {
  let calls = 0; let signal: AbortSignal | null | undefined;
  const sender = createBrevoEmailDelivery(configuration, async (_input, init) => {
    calls++; signal = init?.signal;
    if (phase === 'connection') return await new Promise<Response>(() => {});
    return new Response(new ReadableStream({ start() { /* Synthetic stalled acknowledgement. */ } }), { status: 201 });
  })!;
  const started = Date.now();
  await assert.rejects(sender.send(message()), { message: 'Email delivery could not be confirmed.' });
  assert.ok(Date.now() - started < 8000); assert.equal(signal?.aborted, true); assert.equal(calls, 1);
});

test('concurrent deliveries keep each recipient, code and link isolated', async () => {
  const first = message('verification'), second = message('recovery');
  const bodies: any[] = [];
  const sender = createBrevoEmailDelivery(configuration, async (_input, init) => {
    const body = JSON.parse(String(init?.body)); bodies.push(body);
    await new Promise(resolve => setTimeout(resolve, body.to[0].email === first.email ? 20 : 1));
    return Response.json({ messageId: '<synthetic-only@brevo.test>' }, { status: 201 });
  })!;
  assert.deepEqual(await Promise.all([sender.send(first), sender.send(second)]), ['accepted', 'accepted']);
  for (const [m, other] of [[first, second], [second, first]]) {
    const body = bodies.find(body => body.to[0].email === m!.email);
    assert.ok(body.htmlContent.includes(m!.link)); assert.ok(!body.htmlContent.includes(other!.link));
    assert.equal(body.subject, accountEmailTemplates[m!.purpose].subject);
  }
});

test('actual default production composition fails closed before any provider request when configuration is absent', async () => {
  const original = globalThis.fetch; let external = 0;
  globalThis.fetch = async (input, init) => {
    if (new URL(String(input)).hostname === '127.0.0.1') return original(input, init);
    external++; throw new Error('Provider transport forbidden');
  };
  const { default: app } = await import('../src/app.js');
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    for (const purpose of ['verification', 'recovery']) {
      const response: Response = await original(`http://127.0.0.1:${address.port}/api/auth/email/request`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'fixture@example.invalid', purpose }),
      });
      assert.equal(response.status, 503); assert.match((await response.json()).error.message, /delivery is not configured/);
    }
    assert.equal(external, 0);
  } finally {
    globalThis.fetch = original;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
