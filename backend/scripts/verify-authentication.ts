// Explicit development verification. No email is sent and no credentials/tokens are logged.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { env } from '../src/config/env.js';
import { getSupabaseAdminClient } from '../src/lib/supabase.js';
import { developmentClient } from './database.js';
import app from '../src/app.js';

const project = process.argv[process.argv.indexOf('--project-ref') + 1];
if (!project || env.supabaseUrl !== `https://${project}.supabase.co`) throw new Error('Matching development --project-ref required.');
const email = process.env.VERTWELL_OWNER_EMAIL, password = process.env.VERTWELL_OWNER_PASSWORD;
if (!email || !password) throw new Error('Owner verification credentials required privately.');
// Password mutation is a separate, explicitly authorized development test window.
const verifyPasswordChange = process.argv.includes('--allow-password-change');
const checks: string[] = [];
function check(condition: unknown, label: string) { if (!condition) throw new Error(`Failed: ${label}`); checks.push(label); }
const fresh = () => createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
const admin = getSupabaseAdminClient();
const {client,ref} = await developmentClient();
if (ref !== project) throw new Error('Database project mismatch.');
const server = app.listen(0,'127.0.0.1');
await new Promise<void>(resolve => server.once('listening',resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Missing test listener.');
const base = `http://127.0.0.1:${address.port}`;
let ownerId: string | undefined, passwordChanged = false;
try {
  await client.connect();
  const before = (await client.query('select count(*)::int as users from auth.users')).rows[0].users;
  const login = await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:process.env.VERTWELL_OWNER_USERNAME ?? email,password})});
  if (!login.ok) console.error({loginStatus:login.status,error:(await login.json()).error?.message});
  check(login.status===200,'real username/password login');
  const {session} = await login.json(); ownerId=session.user.id;
  const headers={authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'};
  const response=await fetch(`${base}/api/auth/me`,{headers}); const identity=await response.json();
  check(response.status===200 && identity.profile.id===ownerId && identity.profile.role==='Owner','real active profile and role');
  const restored=fresh(); const set=await restored.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
  check(!set.error && set.data.user?.id===ownerId,'restored real session');
  const wrong=await fresh().auth.signInWithPassword({email,password:randomBytes(16).toString('hex')});
  check(!!wrong.error,'invalid real password denied');
  check((await fetch(`${base}/api/auth/me`,{headers:{authorization:'Bearer invalid'}})).status===401,'invalid live token denied');
  const body={fullName:identity.profile.full_name,username:identity.profile.username,role:'Owner',active:false,updatedAt:identity.profile.updated_at};
  check((await fetch(`${base}/api/auth/accounts/${ownerId}`,{method:'PATCH',headers,body:JSON.stringify(body)})).status===422,'signed-in deactivation denied');
  // A demotion probe would succeed when a second Owner exists. Never demote a
  // real account during verification; last-Owner mutation tests use disposable SQL.
  body.active=true; body.role='Unsupported';
  check((await fetch(`${base}/api/auth/accounts/${ownerId}`,{method:'PATCH',headers,body:JSON.stringify(body)})).status===422,'invalid role change denied without modifying a real Owner');
  const duplicate=await admin.auth.admin.createUser({email:`auth-rollback-${randomBytes(8).toString('hex')}@example.invalid`,password:randomBytes(16).toString('hex'),email_confirm:true,
    app_metadata:{vertwell_provision:{actor_id:ownerId,full_name:'Rollback check',username:identity.profile.username,role:'Staff'}}});
  check(!!duplicate.error,'real provisioning failure rejected');
  check((await client.query('select count(*)::int as users from auth.users')).rows[0].users===before,'Auth/profile provisioning rolled back without residue');
  let logoutClient = restored, revokedRefreshToken = session.refresh_token;
  if (verifyPasswordChange) {
    const recovery=await admin.auth.admin.generateLink({type:'recovery',email});
    if(recovery.error || !recovery.data.properties.hashed_token) throw new Error('Recovery link generation failed.');
    const recoveryClient=fresh();
    const verified=await recoveryClient.auth.verifyOtp({type:'recovery',token_hash:recovery.data.properties.hashed_token});
    check(!verified.error && verified.data.user?.id===ownerId,'real one-time recovery token verified without sending email');
    // Restore even if a lost response leaves the password-write outcome unknown.
    passwordChanged=true;
    const changed=await recoveryClient.auth.updateUser({password:randomBytes(24).toString('base64url')});
    check(!changed.error,'real recovered password update');
    check(!!(await fresh().auth.signInWithPassword({email,password})).error,'old password denied after recovery');
    logoutClient = recoveryClient; revokedRefreshToken = verified.data.session!.refresh_token;
  }
  const logout=await logoutClient.auth.signOut({scope:verifyPasswordChange?'global':'local'});
  check(!logout.error,verifyPasswordChange?'global real logout':'verification session logout');
  check((await fetch(`${base}/api/auth/me`,{headers})).status===401,'logged-out access token denied by live Auth verification');
  check(!!(await fresh().auth.refreshSession({refresh_token:revokedRefreshToken})).error,'logged-out refresh token rejected');
} finally {
  try { if(passwordChanged && ownerId) {
    const restored=await admin.auth.admin.updateUserById(ownerId,{password});
    if(restored.error) throw new Error('Verification account password restoration requires attention.');
    const verified=await fresh().auth.signInWithPassword({email,password});
    check(!verified.error,'requested account password restored and verified');
    if(verified.data.session) await fresh().auth.admin.signOut(verified.data.session.access_token,'global');
  } } finally {
    await client.end();
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
}
console.log(JSON.stringify({project,checks,passed:checks.length,
  passwordVerification:verifyPasswordChange?'explicit change/restore window':'skipped; requires --allow-password-change',
  emailDelivery:'not tested; no email sent'},null,2));
