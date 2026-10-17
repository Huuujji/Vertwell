import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { accountInput } from '../src/lib/accounts.js';
import { getSupabaseAdminClient, createUserDatabaseClient } from '../src/lib/supabase.js';
import { currentProfile } from '../src/lib/accounts.js';
import { env } from '../src/config/env.js';

export async function bootstrapOwner() {
  const project = process.argv[process.argv.indexOf('--project-ref') + 1];
  if (!project || env.supabaseUrl !== `https://${project}.supabase.co`) throw new Error('Supply the matching --project-ref.');
  const input = accountInput({ fullName: process.env.VERTWELL_OWNER_NAME, username: process.env.VERTWELL_OWNER_USERNAME,
    email: process.env.VERTWELL_OWNER_EMAIL, password: process.env.VERTWELL_OWNER_PASSWORD, role: 'Owner' }, true);
  const admin = getSupabaseAdminClient();
  const metadata = { vertwell_provision: { bootstrap: true, full_name: input.fullName, username: input.username, role: 'Owner' } };
  const repairIndex = process.argv.indexOf('--repair-user-id');
  const repairId = repairIndex >= 0 ? process.argv[repairIndex + 1] : undefined;
  if (repairId) {
    const existing = await admin.auth.admin.getUserById(repairId);
    if (existing.error || existing.data.user.email !== input.email || !existing.data.user.app_metadata.vertwell_provision?.bootstrap) throw new Error('Only the matching incomplete trusted bootstrap can be repaired.');
  }
  const { data, error } = repairId ? await admin.auth.admin.updateUserById(repairId,{app_metadata:metadata})
    : await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, app_metadata: metadata });
  if (error || !data.user) {
    console.error(JSON.stringify({ status: error?.status, code: error?.code }));
    throw new Error('Owner provisioning failed. Existing accounts or duplicate identifiers are not overwritten.');
  }
  const loginClient = createUserDatabaseClient('');
  const login = await loginClient.auth.signInWithPassword({email:input.email,password:input.password});
  if (login.error || !login.data.session) throw new Error('Provisioned identity could not sign in.');
  try { await currentProfile(createUserDatabaseClient(login.data.session.access_token)); }
  finally { await loginClient.auth.signOut(); }
  console.log(JSON.stringify({ project, ownerId: data.user.id, status: 'Owner provisioned; credentials omitted' }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  bootstrapOwner().catch(() => { console.error('Owner provisioning failed; no credentials logged.'); process.exitCode = 1; });
}
