import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { managementServer } from './fixtures/management-server';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test.describe.configure({mode:'serial'});
let api:Awaited<ReturnType<typeof managementServer>>;
const evidence=process.env.VERTWELL_VERIFICATION_EVIDENCE ?? fileURLToPath(new URL('../../../memory/backend/supabase/major-adjustments-evidence/2026-10-26-adjustment3-resume/browser/',import.meta.url));
test.beforeAll(async()=>{await mkdir(evidence,{recursive:true});api=await managementServer();});
test.afterAll(async()=>{await api?.close();});
async function setup(context:BrowserContext) {
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    return ['127.0.0.1','management.test'].includes(url.hostname)?route.fallback():route.abort('blockedbyclient');
  });
  await api.setup(context);
}
async function users(page:Page) {
  await expect(page.locator('.workspace')).toBeVisible();
  const menu=page.getByRole('button',{name:'Open navigation',exact:true});
  if(await menu.isVisible())await menu.click();
  await page.getByRole('button',{name:'Users',exact:true}).click();
  await expect(page.getByRole('heading',{name:'User Management',exact:true})).toBeVisible();
}
async function add(page:Page,name:string,role='Staff') {
  await page.getByRole('button',{name:'Add User',exact:true}).click();
  await page.getByLabel('Full Name',{exact:true}).fill(name);
  await page.getByLabel('Username',{exact:true}).fill(name);
  await page.getByRole('dialog').locator('select').first().selectOption(role);
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByLabel('Email Address',{exact:true}).fill(`${name}@example.invalid`);
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.getByLabel('Password',{exact:true}).fill('Test-password-123');
  await page.getByLabel('Confirm Password',{exact:true}).fill('Test-password-123');
  await page.getByRole('button',{name:'Add Account',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const row=page.getByRole('group',{name:`${name} account`,exact:true});
  await expect(row).toContainText('Email verification pending · access blocked');
  return row;
}

test('controlled provisioning and recipient link preserve manager storage; pending login fails and verified Users status refreshes',async({page,browser})=>{
  await setup(page.context());await api.login(page);await users(page);
  const before=await page.evaluate(()=>localStorage.getItem('sb-management-auth-token'));
  const row=await add(page,'verify-recipient');
  await page.setViewportSize({width:390,height:844});
  await expect(row).toContainText('Email verification pending · access blocked');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:`${evidence}/pending-mobile.png`,fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  const target=(await api.db.query<{id:string}>('select id from auth.users where email=$1',['verify-recipient@example.invalid'])).rows[0];
  expect(target).toBeTruthy();
  expect(await page.evaluate(()=>localStorage.getItem('sb-management-auth-token'))).toBe(before);
  const recipient=await browser.newContext();await setup(recipient);const recipientPage=await recipient.newPage();
  await recipientPage.goto('/');await recipientPage.getByLabel('Username or email').fill('verify-recipient@example.invalid');
  await recipientPage.getByLabel('Password',{exact:true}).fill('Test-password-123');await recipientPage.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(recipientPage).toHaveURL(/\/auth\/verify$/);
  await expect(recipientPage.getByRole('heading',{name:'Enter your verification code'})).toBeFocused();
  await expect(recipientPage.getByLabel('Email code',{exact:true})).toBeVisible();
  await expect(recipientPage.locator('.workspace')).toHaveCount(0);
  // Even a provider-issued/restored pending token must not open protected content.
  await recipientPage.evaluate(value=>localStorage.setItem('sb-management-auth-token',JSON.stringify(value)),api.recipientSession(target!.id));
  await recipientPage.goto('/Login');await expect(recipientPage.locator('.workspace')).toHaveCount(0);
  await expect(recipientPage.getByText(/Verify your account email before accessing the shop/)).toBeVisible();
  const message=api.messages.find(m=>m.email==='verify-recipient@example.invalid')!;
  const link=await page.context().newPage();
  await link.goto(`/auth/verify#token_hash=${message.hash}`);
  await expect(link.getByRole('heading',{name:'Confirm your email'})).toBeVisible();
  await expect(link).toHaveTitle('Confirm your email | HappyHentie');
  await expect(link).toHaveURL(/\/auth\/verify$/);
  await expect(row).toContainText('Email verification pending'); // Opening alone does not confirm.
  await link.setViewportSize({width:390,height:844});
  expect(await link.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await link.screenshot({path:`${evidence}/verification-link-confirmation-mobile.png`,fullPage:true});
  await link.setViewportSize({width:1280,height:900});
  await link.getByRole('button',{name:'Verify email',exact:true}).click();
  await expect(link.getByRole('heading',{name:'Email verified',exact:true})).toBeFocused();
  await expect(link).toHaveTitle('Email verified | HappyHentie');
  await expect(link.getByText('Your account email has been verified. You do not need to verify it again.')).toBeVisible();
  await expect(link.locator('form, details')).toHaveCount(0);
  await expect(link.getByRole('button',{name:'Verify email',exact:true})).toHaveCount(0);
  await expect(link.getByText('Opening this page has not verified it yet.',{exact:false})).toHaveCount(0);
  await expect(link.getByText('An account already signed in on this browser will stay signed in when you return.',{exact:false})).toBeVisible();
  await link.screenshot({path:`${evidence}/verification-link-success-desktop.png`,fullPage:true});
  await expect(row).toContainText('Email verified'); // Auth-triggered invalidation, no manual reload.
  await page.screenshot({path:`${evidence}/verified-desktop.png`,fullPage:true});
  expect(await link.evaluate(()=>localStorage.getItem('sb-management-auth-token'))).toBe(before);
  expect(api.loggedOut).not.toContain(api.ids.Owner);
  await page.reload();await users(page);
  await expect(page.getByRole('group',{name:'owner account',exact:true})).toContainText('You');
  await link.getByRole('link',{name:'Return to HappyHentie',exact:true}).click();
  await expect(link.locator('.workspace')).toBeVisible();
  expect(await link.evaluate(()=>localStorage.getItem('sb-management-auth-token'))).toBe(before);
  await link.close();await recipient.close();
});

test('failed delivery retains pending target; PATCH retains status; pending Owner cannot replace current accessible Owner',async({page})=>{
  await setup(page.context());await api.login(page);await users(page);
  // Existing Admin/Staff remain legitimate; only one accessible Owner exists here.
  api.failVerificationDelivery(true);
  let row;
  try {row=await add(page,'pending-owner','Owner');} finally {api.failVerificationDelivery(false);}
  expect(api.messages.some(m=>m.email==='pending-owner@example.invalid')).toBe(false);
  expect((await api.db.query('select * from auth.users where email=$1',['pending-owner@example.invalid'])).rows).toHaveLength(1);
  await row.getByRole('button',{name:'Manage',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Pending renamed');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(row).toContainText('Email verification pending');
  await page.getByRole('group',{name:'owner account',exact:true}).getByRole('button',{name:'Manage',exact:true}).click();
  await expect(page.getByRole('button',{name:'Deactivate Account',exact:true})).toBeDisabled();
  await page.getByRole('dialog').locator('select').first().selectOption('Staff');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Keep at least one owner account.');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Discard changes',exact:true}).click();
  await expect(page.getByRole('group',{name:'owner account',exact:true})).toContainText('You');
});

test('verification code from separate recipient context refreshes manager without session replacement',async({page,browser})=>{
  await setup(page.context());await api.login(page);await users(page);
  const row=await add(page,'code-recipient');
  const managerStorage=await page.evaluate(()=>localStorage.getItem('sb-management-auth-token'));
  const context=await browser.newContext();await setup(context);const other=await context.newPage();
  await other.goto('/auth/verify');await other.getByLabel('Account email',{exact:true}).first().fill('code-recipient@example.invalid');
  await other.getByLabel('Email code',{exact:true}).fill(api.messages.find(m=>m.email==='code-recipient@example.invalid')!.code);
  await expect(other.getByRole('heading',{name:'Enter your verification code'})).toBeVisible();
  await other.getByRole('button',{name:'Verify email',exact:true}).click();
  await expect(other.getByRole('heading',{name:'Email verified',exact:true})).toBeFocused();
  await expect(other).toHaveTitle('Email verified | HappyHentie');
  await expect(other.getByText('Your account email has been verified. You do not need to verify it again.')).toBeVisible();
  await expect(other.locator('form, details')).toHaveCount(0);
  await expect(other.getByText('Enter the code from your verification email to confirm your account email.')).toHaveCount(0);
  await other.setViewportSize({width:390,height:844});
  expect(await other.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await other.screenshot({path:`${evidence}/verification-code-success-mobile.png`,fullPage:true});
  await expect(row).toContainText('Email verified');
  expect(await page.evaluate(()=>localStorage.getItem('sb-management-auth-token'))).toBe(managerStorage);
  expect(await other.evaluate(()=>localStorage.getItem('sb-management-auth-token'))).toBeNull();
  expect(api.loggedOut).not.toContain(api.ids.Owner);
  await other.getByRole('link',{name:'Return to HappyHentie',exact:true}).click();
  await expect(other.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  await context.close();
});

test('recovery code and confirmed link require a new password, scrub tokens and preserve manager storage',async({page,browser})=>{
  await setup(page.context());await api.login(page);await users(page);
  const managerStorage=await page.evaluate(()=>localStorage.getItem('sb-management-auth-token'));
  const email='code-recipient@example.invalid';
  const id=(await api.db.query<{id:string}>('select id from auth.users where email=$1',[email])).rows[0]!.id;
  for(const byLink of [false,true]) {
    await api.db.query("update private.email_challenges set next_send_at=clock_timestamp()-interval '1 second' where user_id=$1",[id]);
    const requested=await page.evaluate(async email=>{
      const response=await fetch('/api/auth/email/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,purpose:'recovery'})});return response.status;
    },email);expect(requested).toBe(200);
    const message=api.messages.filter(m=>m.email===email&&m.purpose==='recovery').at(-1)!;
    const context=await browser.newContext();await setup(context);const recipient=await context.newPage();
    let completions=0;recipient.on('request',request=>{if(request.url().includes('/api/auth/email/complete'))completions++;});
    await recipient.goto(byLink?`/auth/recover?next=https://outside.invalid#token_hash=${message.hash}`:'/auth/recover');
    await expect(recipient).toHaveURL(/\/auth\/recover$/);expect(completions).toBe(0);
    await recipient.setViewportSize({width:390,height:844});
    expect(await recipient.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await recipient.screenshot({path:`${evidence}/recovery-${byLink?'link':'code'}-mobile.png`,fullPage:true});
    expect((await api.db.query<{used_at:unknown}>('select used_at from private.email_challenges where user_id=$1 and purpose=$2',[id,'recovery'])).rows[0]!.used_at).toBeNull();
    if(!byLink){await recipient.getByLabel('Account email',{exact:true}).first().fill(email);await recipient.getByLabel('Email code',{exact:true}).fill(message.code);}
    await recipient.getByLabel('New password',{exact:true}).fill('Recovered-test-123');await recipient.getByLabel('Confirm password',{exact:true}).fill('Recovered-test-123');
    await recipient.getByRole('button',{name:'Change password',exact:true}).click();
    await expect(recipient.getByRole('heading',{name:'Password changed',exact:true})).toBeFocused();
    await expect(recipient).toHaveTitle('Password changed | HappyHentie');
    await expect(recipient.getByText('Your password has been changed.',{exact:true})).toBeVisible();
    await expect(recipient.locator('form, details, input')).toHaveCount(0);
    await expect(recipient.getByText('Opening this page has not changed your password.',{exact:false})).toHaveCount(0);
    await expect(recipient.getByRole('button',{name:'Change password',exact:true})).toHaveCount(0);
    await recipient.screenshot({path:`${evidence}/recovery-${byLink?'link':'code'}-success-mobile.png`,fullPage:true});
    expect(completions).toBe(1);
    expect(await recipient.evaluate(()=>localStorage.getItem('sb-management-auth-token'))).toBeNull();
    const retry=await context.newPage();await retry.goto(`/auth/recover#token_hash=${message.hash}`);
    await retry.getByLabel('New password',{exact:true}).fill('Denied-retry-123');await retry.getByLabel('Confirm password',{exact:true}).fill('Denied-retry-123');
    await retry.getByRole('button',{name:'Change password',exact:true}).click();await expect(retry.getByRole('alert')).toContainText('already been used');
    await recipient.goto('/');await recipient.getByLabel('Username or email').fill(email);await recipient.getByLabel('Password',{exact:true}).fill('Recovered-test-123');
    await recipient.getByRole('button',{name:'Log in',exact:true}).click();await expect(recipient.locator('.workspace')).toBeVisible();
    await context.close();
  }
  expect(await page.evaluate(()=>localStorage.getItem('sb-management-auth-token'))).toBe(managerStorage);
  expect(api.loggedOut).not.toContain(api.ids.Owner);
});

test('malformed link is scrubbed without submission and offers code entry',async({page})=>{
  await setup(page.context());await page.goto('/auth/recover#token_hash=bad&redirect_to=https://outside.invalid');
  await expect(page).toHaveURL(/\/auth\/recover$/);await expect(page.getByRole('alert')).toContainText('link is invalid');
  await expect(page.getByLabel('Email code',{exact:true})).toBeVisible();
});

test('verification feedback distinguishes invalid fields, progress and completion without stale resend prompts',async({page})=>{
  await setup(page.context());
  let sends=0,completions=0,release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/auth/email/request',route=>{sends++;return route.fulfill({json:{message:'Synthetic request accepted'}});});
  await page.route('**/api/auth/email/complete',async route=>{completions++;await gate;await route.fulfill({json:{verified:true,purpose:'verification'}});});
  await page.goto('/auth/verify');
  await page.setViewportSize({width:320,height:740});
  await expect(page.getByRole('heading',{name:'Enter your verification code'})).toBeFocused();
  await page.getByRole('button',{name:'Verify email',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Check the highlighted fields and try again.');
  await expect(page.getByLabel('Account email',{exact:true})).toHaveAttribute('aria-invalid','true');
  await expect(page.getByLabel('Email code',{exact:true})).toHaveAttribute('aria-invalid','true');
  expect(completions).toBe(0);expect(sends).toBe(0);
  await page.getByLabel('Account email',{exact:true}).fill('feedback@example.invalid');
  await page.getByText('Request a fresh email',{exact:true}).click();
  await page.getByRole('button',{name:'Send code and link',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('If this account is eligible');
  await expect(page.getByRole('button',{name:/Wait \d+ seconds/})).toBeDisabled();
  await page.getByLabel('Email code',{exact:true}).fill('12345678');
  await page.screenshot({path:`${evidence}/verification-code-entry-320.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  try {
    await page.getByRole('button',{name:'Verify email',exact:true}).click();
    await expect(page.getByRole('button',{name:'Verifying email…',exact:true})).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText('Verifying your account email…');
    await expect.poll(()=>completions).toBe(1);
  } finally {release();}
  await expect(page.getByRole('heading',{name:'Email verified',exact:true})).toBeFocused();
  await expect(page.locator('form, details, [role="status"], [role="alert"]')).toHaveCount(0);
  await expect(page.getByText('Use the newest code OR link.',{exact:false})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Return to HappyHentie',exact:true})).toBeVisible();
  expect(completions).toBe(1);expect(sends).toBe(1);
});

test('expired verification preserves entered values and gives truthful recovery guidance without automatic resend',async({page})=>{
  await setup(page.context());let sends=0,completions=0;
  await page.route('**/api/auth/email/request',route=>{sends++;return route.fulfill({json:{}});});
  await page.route('**/api/auth/email/complete',route=>{completions++;return route.fulfill({status:422,json:{error:{message:'This code or link has expired. Request a fresh email.'}}});});
  await page.goto('/auth/verify');
  await page.getByLabel('Account email',{exact:true}).fill('expired@example.invalid');
  await page.getByLabel('Email code',{exact:true}).fill('12345678');
  await page.getByRole('button',{name:'Verify email',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Verification could not be completed'})).toBeVisible();
  await expect(page).toHaveTitle('Error: Verification could not be completed | HappyHentie');
  await expect(page.getByRole('alert')).toHaveText('This code or link has expired. Request a fresh email.');
  await expect(page.getByLabel('Account email',{exact:true})).toHaveValue('expired@example.invalid');
  await expect(page.getByLabel('Email code',{exact:true})).toHaveValue('12345678');
  await expect(page.getByRole('heading',{name:'Email verified',exact:true})).toHaveCount(0);
  await page.screenshot({path:`${evidence}/verification-expired-desktop.png`,fullPage:true});
  expect(completions).toBe(1);expect(sends).toBe(0);
});

test('recovery feedback validates fields and preserves uncertainty without automatic resend or false success',async({page})=>{
  await setup(page.context());let sends=0,completions=0,release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/auth/email/request',route=>{sends++;expect(route.request().postDataJSON().purpose).toBe('recovery');return route.fulfill({json:{message:'Synthetic request accepted'}});});
  await page.route('**/api/auth/email/complete',async route=>{completions++;expect(route.request().postDataJSON().purpose).toBe('recovery');await gate;await route.fulfill({status:503,json:{error:{message:'Session cleanup could not be confirmed. Ask the Owner to review account sessions before continuing.'}}});});
  await page.goto('/auth/recover');
  await expect(page.getByRole('heading',{name:'Choose a new password'})).toBeFocused();
  await page.getByRole('button',{name:'Change password',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Check the highlighted fields and try again.');
  for(const field of ['Account email','Email code','New password','Confirm password']) await expect(page.getByLabel(field,{exact:true})).toHaveAttribute('aria-invalid','true');
  expect(completions).toBe(0);expect(sends).toBe(0);
  await page.getByLabel('Account email',{exact:true}).fill('recovery-feedback@example.invalid');
  await page.getByText('Request a fresh email',{exact:true}).click();
  await page.getByRole('button',{name:'Send code and link',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('If this account is eligible');
  await page.getByLabel('Email code',{exact:true}).fill('12345678');
  await page.getByLabel('New password',{exact:true}).fill('Recovery-test-123');
  await page.getByLabel('Confirm password',{exact:true}).fill('Mismatch-test-123');
  await page.getByRole('button',{name:'Change password',exact:true}).click();
  await expect(page.getByText('Passwords must match.',{exact:true})).toBeVisible();expect(completions).toBe(0);
  await page.getByLabel('Confirm password',{exact:true}).fill('Recovery-test-123');
  try {
    await page.getByRole('button',{name:'Change password',exact:true}).click();
    await expect(page.getByRole('button',{name:'Changing password…',exact:true})).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText('Changing your password…');
    await expect.poll(()=>completions).toBe(1);
  } finally {release();}
  await expect(page.getByRole('heading',{name:'Password could not be changed'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Session cleanup could not be confirmed');
  await expect(page.getByLabel('New password',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Confirm password',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Account email',{exact:true})).toHaveValue('recovery-feedback@example.invalid');
  await expect(page.getByRole('heading',{name:'Password changed',exact:true})).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(completions).toBe(1);expect(sends).toBe(1);
});
