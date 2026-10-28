import type { SupabaseClient } from '@supabase/supabase-js';
import { databaseError } from './accounts.js';
import { HttpError } from './http-error.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function deletionInput(targetId: unknown, value: unknown) {
  if (typeof targetId !== 'string' || !uuid.test(targetId) || !value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(422, 'An exact account deletion request is required.');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !['operationId','updatedAt'].includes(key)) ||
    typeof body.operationId !== 'string' || !uuid.test(body.operationId) ||
    typeof body.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt)))
    throw new HttpError(422, 'The account revision and deletion request ID are required.');
  return { target_id: targetId.toLowerCase(), expected_updated_at: body.updatedAt, operation_id: body.operationId.toLowerCase() };
}

export async function deleteManagedAccount(database: SupabaseClient, admin: SupabaseClient,
  command: ReturnType<typeof deletionInput>) {
  async function receipt(name: 'prepare_account_deletion' | 'account_deletion_result') {
    const { data, error } = await database.rpc(name, command).abortSignal(AbortSignal.timeout(5000));
    if (error) databaseError(error);
    if (!data || data.targetId !== command.target_id || data.operationId !== command.operation_id ||
      !['ready','completed','stale','superseded'].includes(data.status))
      throw new HttpError(503, 'Account deletion could not be confirmed. Retry this same request to check its outcome.');
    return data as { targetId: string; operationId: string; status: string };
  }
  const prepared = await receipt('prepare_account_deletion');
  if (prepared.status === 'completed') return prepared;
  if (prepared.status !== 'ready') throw new HttpError(409, 'The deletion request is stale. Reload the account and review a new confirmation.');
  // Explicit hard deletion, exact UUID only. The database hook rechecks current
  // authority/revision and commits Auth + challenge cleanup + audit atomically.
  // A provider acknowledgement alone is never a completed deletion receipt.
  try { await admin.auth.admin.deleteUser(command.target_id, false); }
  catch { /* A lost response can still mean the transaction committed. */ }
  const completed = await receipt('account_deletion_result');
  if (completed.status !== 'completed')
    throw new HttpError(completed.status === 'ready' ? 503 : 409,
      'Account deletion is not confirmed. Retry this same request to check its outcome, or reload and review if the account changed.');
  return completed;
}
