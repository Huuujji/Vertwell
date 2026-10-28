import { test, expect, type Page } from '@playwright/test';

const id = '00000000-0000-4000-8000-000000000001';
const user = { id, email: 'owner@example.invalid', aud: 'authenticated', role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-10-17T00:00:00Z' };
const recoveryEvidence = process.env.VERTWELL_RECOVERY_UI_EVIDENCE;
function session() {
  const now = Math.floor(Date.now() / 1000);
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: now + 3600, iat: now, aud: 'authenticated', role: 'authenticated' })).toString('base64url')}.test-signature`;
  return { access_token: token, refresh_token: 'test-refresh', expires_in: 3600, expires_at: now + 3600, token_type: 'bearer', user };
}
async function configured(page: Page) {
  // No unhandled API request may reach a configured development backend.
  await page.route('**/api/**', route => route.fulfill({status:503,json:{error:{message:'Service not configured in this authentication fixture'}}}));
  await page.route('**/src/lib/supabase.ts', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace(/const url = .*?;/, 'const url = "https://auth.test";').replace(/const key = .*?;/, 'const key = "test-publishable";');
    await route.fulfill({ response, body: source, contentType: 'application/javascript' });
  });
  let denied = false;
  await page.route('**/api/auth/me', async route => {
    await route.fulfill({ status: denied ? 403 : 200, json: denied ? { error: { message: 'Account inactive' } } : {
      user: { id, email: user.email }, profile: { id, full_name: 'Real Owner', username: 'real-owner', role: 'Owner', active: true, updated_at: '2026-10-17T00:00:00Z' },
    } });
  });
  await page.route('https://auth.test/**', async route => {
    const url = route.request().url();
    if (url.includes('/logout')) await route.fulfill({ status: 204 });
    else if (url.includes('/user')) await route.fulfill({ json: user });
    else if (url.includes('/token')) await route.fulfill({ json: session() });
    else if (url.includes('/recover')) await route.fulfill({ json: {} });
    else await route.fulfill({ status: 400, json: { error: 'invalid_request' } });
  });
  await page.route('**/api/auth/login', route => route.fulfill({ json: { session: session() } }));
  return { deny() { denied = true; } };
}
async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Username or email').fill('real-owner');
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

test('login throttling and protection outages keep the account closed and allow an explicit later retry', async ({ page }) => {
  await configured(page);
  let attempts = 0;
  await page.route('**/api/auth/login', route => {
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 429, headers: { 'Retry-After': '60' },
      json: { error: { message: 'Too many login attempts. Try again in a minute.' } } });
    if (attempts === 2) return route.fulfill({ status: 503,
      json: { error: { message: 'Login protection is unavailable. Try again shortly.' } } });
    return route.fulfill({ json: { session: session() } });
  });
  await login(page);
  await expect(page.getByRole('alert')).toHaveText('Too many login attempts. Try again in a minute.');
  await expect(page.locator('.workspace')).toHaveCount(0);
  expect(attempts).toBe(1);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Login protection is unavailable. Try again shortly.');
  await expect(page.locator('.workspace')).toHaveCount(0);
  expect(attempts).toBe(2);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.locator('.nav-identity').filter({ hasText: 'real-owner' })).toBeVisible();
  expect(attempts).toBe(3);
});

test('configured login uses the real Owner profile, restores it and logs out without exposing sample business data', async ({ page }) => {
  await configured(page); await login(page);
  await expect(page.locator('.nav-identity').filter({hasText:'real-owner'})).toBeVisible();
  await expect(page.locator('.nav-identity')).toContainText('Owner');
  await expect(page.getByRole('heading',{name:/Welcome,/})).toHaveCount(0);
  await expect(page.getByText('Sample data · resets on refresh', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.nav-identity').filter({hasText:'real-owner'})).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('profile denial removes authenticated content and offers explicit retry/logout', async ({ page }) => {
  const policy = await configured(page); await login(page);
  await expect(page.locator('.nav-identity').filter({hasText:'real-owner'})).toBeVisible();
  policy.deny(); await page.reload();
  await expect(page.getByRole('alert')).toContainText('Account inactive');
  await expect(page.locator('.nav-identity').filter({hasText:'real-owner'})).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});

test('configured recovery requests the purpose-bound code/link flow and retains invalid legacy callback protection', async ({ page }) => {
  await configured(page);
  await page.route('**/api/auth/email/request',route=>route.fulfill({json:{message:'Synthetic recovery request accepted'}}));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Verify account email with code or link' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeFocused();
  if (recoveryEvidence) {
    await page.screenshot({path:`${recoveryEvidence}/forgot-password-desktop.png`,fullPage:true});
    await page.setViewportSize({width:320,height:740});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`${recoveryEvidence}/forgot-password-320.png`,fullPage:true});
    await page.setViewportSize({width:1280,height:720});
  }
  await expect(page.getByRole('link', { name: 'Recover with an email code or link' })).toHaveCount(0);
  await expect(page).toHaveTitle('Reset your password | HappyHentie');
  await page.getByRole('button', { name: 'Back to login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeFocused();
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  await page.getByLabel('Account email', { exact: true }).fill(user.email);
  const request = page.waitForRequest(request => request.url().endsWith('/api/auth/email/request'));
  await page.getByRole('button', { name: 'Send recovery email', exact: true }).click();
  expect((await request).postDataJSON()).toEqual({email:user.email,purpose:'recovery'});
  await expect(page).toHaveURL('/auth/recover');
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeFocused();
  await expect(page.getByLabel('Email code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page.getByText('Enter the newest recovery code and choose a new password, OR open the link in that email.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Return to HappyHentie' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.goto('/auth/callback?error=access_denied&error_description=expired');
  await expect(page.getByRole('alert')).toContainText('invalid or expired');
  await expect(page).toHaveURL('/');
});

test('forgot password validates the email and handles uncertain delivery without automatic retry or false confirmation', async ({page})=>{
  await configured(page);let requests=0;
  await page.route('**/api/auth/email/request',route=>{requests++;return route.fulfill({status:503,json:{error:{message:'Email delivery could not be confirmed. If an email arrives, its code or link may still work. Wait before requesting another.'}}});});
  await page.goto('/');await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
  await page.getByRole('button',{name:'Send recovery email',exact:true}).click();
  await expect(page.getByLabel('Account email',{exact:true})).toHaveAttribute('aria-invalid','true');expect(requests).toBe(0);
  await page.getByLabel('Account email',{exact:true}).fill(user.email);
  await page.getByRole('button',{name:'Send recovery email',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Email delivery could not be confirmed');
  await expect(page).toHaveTitle('Error: Reset your password | HappyHentie');
  await expect(page.getByRole('heading',{name:'Reset your password'})).toBeVisible();
  await expect(page.getByLabel('Account email',{exact:true})).toHaveValue(user.email);
  await expect(page.getByRole('status')).toHaveCount(0);expect(requests).toBe(1);
  await page.getByRole('button',{name:'Back to login',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeFocused();
});

test('pending sign-in opens existing verification code entry without sending another email', async ({ page }) => {
  await configured(page);
  let sends = 0;
  await page.route('**/api/auth/email/request', route => { sends++; return route.fulfill({ json: {} }); });
  await page.route('**/api/auth/login', route => route.fulfill({ status: 403, json: { error: {
    message: 'Verify your account email before signing in.', fields: { accountEmail: 'verification_required' },
  } } }));
  await login(page);
  await expect(page).toHaveURL('/auth/verify');
  await expect(page.getByRole('heading', { name: 'Enter your verification code' })).toBeFocused();
  await expect(page.getByLabel('Account email', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Email code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
  await expect(page.locator('.workspace')).toHaveCount(0);
  expect(sends).toBe(0);
  await page.getByRole('link', { name: 'Return to HappyHentie' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('PKCE recovery callback changes the actual SDK password and signs out', async ({ page }) => {
  await configured(page);
  let exchanges = 0;
  page.on('request', request => { if (request.url().includes('grant_type=pkce')) exchanges++; });
  await page.addInitScript(() => localStorage.setItem('sb-auth-auth-token-code-verifier', JSON.stringify('test-verifier/recovery')));
  await page.goto('/auth/callback?code=test-recovery-code');
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await expect(page).toHaveTitle('Choose a new password | HappyHentie');
  if (recoveryEvidence) await page.screenshot({path:`${recoveryEvidence}/legacy-recovery-form-desktop.png`,fullPage:true});
  await page.getByRole('button',{name:'Show passwords',exact:true}).click();
  await expect(page.getByLabel('New password',{exact:true})).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Hide passwords',exact:true}).click();
  await page.getByLabel('New password', { exact: true }).fill('Changed-password-123');
  await page.getByLabel('Confirm password', { exact: true }).fill('Changed-password-123');
  const update = page.waitForRequest(request => request.url().includes('/auth/v1/user') && request.method() === 'PUT');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  expect((await update).postDataJSON().password).toBe('Changed-password-123');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Password changed. Sign in with your new password.');
  expect(exchanges).toBe(1);
});

test('recovery callback exchanges the verifier for its exact PKCE flow', async ({ page }) => {
  await configured(page);
  await page.addInitScript(() => localStorage.setItem('sb-auth-auth-token-flow-12345678-1234-1234-1234-123456789abc-code-verifier',
    JSON.stringify('flow-specific-verifier/recovery')));
  const exchange = page.waitForRequest(request => request.url().includes('grant_type=pkce'));
  await page.goto('/auth/callback?code=flow-recovery-code&sb_flow_id=12345678-1234-1234-1234-123456789abc');
  expect((await exchange).postDataJSON().code_verifier).toBe('flow-specific-verifier');
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await expect(page).toHaveURL('/');
});

for (const callback of ['expired', 'missing-verifier', 'non-recovery', 'empty', 'provider-error']) {
  test(`${callback} callback cannot reuse an existing session as password-recovery proof`, async ({ page }) => {
    await configured(page);
    await login(page);
    await expect(page.locator('.nav-identity').filter({hasText:'real-owner'})).toBeVisible();
    await page.evaluate(kind => {
      if (kind === 'expired' || kind === 'non-recovery') {
        localStorage.setItem('sb-auth-auth-token-code-verifier', JSON.stringify(`test-verifier${kind === 'expired' ? '/recovery' : ''}`));
      }
    }, callback);
    if (callback === 'expired') await page.route('**/auth/v1/token?grant_type=pkce', route => route.fulfill({
      status: 400, json: { error: 'invalid_grant', error_description: 'Code expired' },
    }));
    await page.goto(callback === 'empty' ? '/auth/callback' : callback === 'provider-error'
      ? '/auth/callback?error_code=otp_expired' : '/auth/callback?code=invalid-recovery-code');
    await expect(page.getByRole('alert')).toContainText('invalid or expired');
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toHaveCount(0);
    await expect(page.locator('.nav-identity').filter({hasText:'real-owner'})).toHaveCount(0);
    await expect(page).toHaveURL('/');
  });
}
