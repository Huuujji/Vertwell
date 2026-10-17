import { databaseSchema } from './database.generated';
import type { Row, Table } from './database.generated';
import { ApiError } from '../api-client';

export const inventoryTables = ['inventory_units', 'skus', 'stock_items', 'stock_batches', 'products',
  'product_recipe_items', 'product_variants', 'modifier_groups', 'modifier_options',
  'modifier_stock_inputs', 'bundle_components', 'bundle_component_modifiers'] as const;
export type InventoryTable = typeof inventoryTables[number];

// Prepared wire contract, NOT an existing HTTP route. P5 must assemble one coherent
// authorized snapshot. Decimal SUMs must be cast to text before JSON serialization.
export type InventorySnapshot = { version: 1; businessDate: string; tables: { [T in InventoryTable]: Row<T>[] };
  balances: { batch_id: string; quantity_base: string }[]; revision?: string;
  edits?: { entity_type: string; entity_id: string; actor_name: string; actor_role: string; occurred_at: string }[] };
export type ManagedAccount = Row<'profiles'> & { email: string }; // email supplied by authorized Auth administration

export function invalidResponse(detail: string): never {
  throw new ApiError(`Invalid data response: ${detail}.`, 'response');
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse('expected an object');
  return value as Record<string, unknown>;
}
export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalidResponse('expected a list');
  return value;
}
export function choice<T extends string>(value: string, values: readonly T[]): T {
  if (!values.includes(value as T)) invalidResponse(`unsupported value for ${values.join('/')}`);
  return value as T;
}
export function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) invalidResponse('invalid business date');
  return value;
}
export function decodeRow<T extends Table>(table: T, value: unknown): Row<T> {
  const input = record(value), result: Record<string, unknown> = {};
  for (const [column, [kind, nullable]] of Object.entries(databaseSchema[table])) {
    const field = input[column];
    if (nullable && field === null) { result[column] = null; continue; }
    const valid = kind === 'decimal' ? typeof field === 'string' && /^-?\d+(?:\.\d+)?$/.test(field)
      : kind === 'number' ? typeof field === 'number' && Number.isSafeInteger(field)
      : kind === 'json' ? field !== undefined : typeof field === kind;
    if (!valid) invalidResponse(`${table}.${column}`);
    result[column] = field;
  }
  return result as Row<T>;
}

export function decodeInventory(value: unknown): InventorySnapshot {
  const input = record(value), tables = record(input.tables);
  if (input.version !== 1) invalidResponse('unsupported inventory contract version');
  const decoded = Object.fromEntries(inventoryTables.map(table => [table, array(tables[table]).map(row => decodeRow(table, row))])) as InventorySnapshot['tables'];
  return { version: 1, businessDate: date(input.businessDate), tables: decoded,
    ...(typeof input.revision === 'string' && /^\d+$/.test(input.revision) ? { revision: input.revision } : {}),
    ...(Array.isArray(input.edits) ? { edits: input.edits.map(value => {
      const row = record(value);
      if (['entity_type','entity_id','actor_name','actor_role','occurred_at'].some(key=>typeof row[key]!=='string')) invalidResponse('edit attribution');
      return row as NonNullable<InventorySnapshot['edits']>[number];
    }) } : {}),
    balances: array(input.balances).map(value => {
      const row = record(value);
      if (typeof row.batch_id !== 'string' || typeof row.quantity_base !== 'string') invalidResponse('batch balance');
      return { batch_id: row.batch_id, quantity_base: row.quantity_base };
    }) };
}

// Live business methods deliberately fail before making any request. A frontend
// flag or a configured publishable key must not bypass the P3/P4/P5 dependencies.
export const pendingBusinessData = {
  async inventory(): Promise<InventorySnapshot> {
    throw new ApiError('Inventory connection is awaiting authenticated, authorized APIs.', 'unavailable');
  },
  async accounts(): Promise<ManagedAccount[]> {
    throw new ApiError('Account connection is awaiting authenticated, authorized APIs.', 'unavailable');
  },
};
