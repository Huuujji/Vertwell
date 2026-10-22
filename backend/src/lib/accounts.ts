import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http-error.js';

export interface Profile { id: string; full_name: string; username: string; role: 'Owner' | 'Admin' | 'Staff'; active: boolean; updated_at: string }
export function databaseError(error: { code?: string } | null): never {
  if (error?.code === '42501') throw new HttpError(403, 'Account access is not permitted.');
  if (error?.code === 'PT409' || error?.code === '23505' || error?.code === '40001') throw new HttpError(409, 'Account changed or username is already used. Reload and review.');
  if (error?.code?.startsWith('23')) throw new HttpError(422, 'Account change violates account protection or validation rules.');
  throw new HttpError(503, 'Account service is unavailable.');
}
export async function currentProfile(client: SupabaseClient): Promise<Profile> {
  const { data, error } = await client.rpc('current_profile').abortSignal(AbortSignal.timeout(5000));
  if (error) databaseError(error);
  if (!data?.id || !data.active || !['Owner','Admin','Staff'].includes(data.role)) throw new HttpError(403, 'Account is inactive or has no application profile.');
  return data as Profile;
}
export function accountInput(value: unknown, create = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(422, 'Account details are required.');
  const body = value as Record<string, unknown>;
  const allowed = create ? ['fullName','username','role','email','password','operationId'] : ['fullName','username','role','active','updatedAt'];
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new HttpError(422, 'Unexpected account field.');
  if (body.operationId !== undefined && (typeof body.operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.operationId))) throw new HttpError(422, 'Invalid account operation ID.');
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  if (!fullName || fullName.length > 80 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(username) || !['Owner','Admin','Staff'].includes(String(body.role))) throw new HttpError(422, 'Enter a name, valid username and role.');
  if (create && (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128)) throw new HttpError(422, 'Enter a valid email and a password of 8–128 characters.');
  if (!create && (typeof body.active !== 'boolean' || typeof body.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt)))) throw new HttpError(422, 'Active state and the current account revision are required.');
  return { fullName, username, role: body.role as Profile['role'], email: body.email as string, password: body.password as string, active: body.active as boolean, updatedAt: body.updatedAt as string };
}
