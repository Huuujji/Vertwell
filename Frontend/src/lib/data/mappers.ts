import type { Account, Category, ModifierGroup, Product, RecipeInput, Role, StockItem } from '../../data/demo';
import { array, choice, decodeInventory, decodeRow, invalidResponse, record } from './contracts';
import { displayDecimal, scaledDecimal } from './decimal';

const categories: readonly Category[] = ['Food', 'Beverage', 'Hobby'];
const roles: readonly Role[] = ['Owner', 'Admin', 'Staff'];
const units = { g: 1, kg: 1000, ml: 1, L: 1000, pcs: 1, bottles: 1 } as const;
const models = { 'Retail Item': 'Stocked', Recipe: 'Made to order', Variants: 'Variants', Bundle: 'Bundle' } as const;
function index<T>(rows: T[], key: (row: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const id = key(row);
    if (result.has(id)) invalidResponse('duplicate record identity');
    result.set(id, row);
  }
  return result;
}
function required<T>(map: Map<string, T>, id: string): T {
  return map.get(id) ?? invalidResponse('missing linked record');
}
const active = (row: { archived_at: string | null }) => row.archived_at === null;

export function mapAccounts(value: unknown): (Account & { active: boolean })[] {
  const accounts = array(value).map(value => {
    const profile = decodeRow('profiles', value), email = record(value).email;
    if (typeof email !== 'string') invalidResponse('missing authorized account email');
    return { id: profile.id, name: profile.full_name, username: profile.username, email,
      role: choice(profile.role, roles), active: profile.active };
  });
  index(accounts, account => account.id);
  return accounts;
}

// Only the prepared contract is accepted, never raw unpaginated PostgREST results.
// Server balances include EVERY movement and batch, even when archived history exists.
export function mapInventory(value: unknown) {
  const snapshot = decodeInventory(value), t = snapshot.tables;
  for (const rows of Object.values(t)) {
    index(rows as ({ id: string } | { code: string } | { component_id: string; option_id: string })[], row => 'id' in row ? row.id : 'code' in row ? row.code : `${row.component_id}:${row.option_id}`);
  }
  if (t.inventory_units.length !== Object.keys(units).length) invalidResponse('incomplete units');
  for (const row of t.inventory_units) {
    const unit = choice(row.code, Object.keys(units) as (keyof typeof units)[]);
    if (displayDecimal(row.factor, 3) !== units[unit]) invalidResponse('unexpected unit factor');
  }
  const skus = index(t.skus, row => row.id), stocks = index(t.stock_items, row => row.id);
  const productRows = index(t.products, row => row.id), variants = index(t.product_variants, row => row.id);
  const groups = index(t.modifier_groups, row => row.id), options = index(t.modifier_options, row => row.id);
  const batches = index(t.stock_batches, row => row.id);
  const balances = index(snapshot.balances, row => row.batch_id);
  if (balances.size !== batches.size) invalidResponse('incomplete batch balances');
  for (const row of t.stock_batches) { required(stocks, row.stock_item_id); required(balances, row.id); }
  for (const row of snapshot.balances) {
    required(batches, row.batch_id);
    if (scaledDecimal(row.quantity_base, 6) < 0n) invalidResponse('negative physical stock');
  }
  const skuFor = (id: string) => required(skus, id).value;
  const edited = (id: string, type: string) => {
    const row = snapshot.edits?.find(row => row.entity_id===id && row.entity_type===type);
    return row ? { editedBy: `${row.actor_name} (${row.actor_role})`, editedAt: row.occurred_at } : {};
  };
  function input(row: { stock_item_id: string; quantity: string; unit_code: string }): RecipeInput {
    required(stocks, row.stock_item_id);
    choice(row.unit_code, Object.keys(units));
    return { stockId: row.stock_item_id, quantity: displayDecimal(row.quantity, 6), unit: row.unit_code };
  }
  for (const row of t.product_recipe_items) { required(productRows, row.product_id); input(row); }
  for (const row of t.product_variants) { required(productRows, row.product_id); required(stocks, row.stock_item_id); }
  for (const row of t.modifier_groups) if (row.product_id) required(productRows, row.product_id);
  for (const row of t.modifier_options) required(groups, row.group_id);
  for (const row of t.modifier_stock_inputs) { required(options, row.option_id); input(row); }
  for (const row of t.bundle_component_modifiers) {
    if (!t.bundle_components.some(component => component.id === row.component_id)) invalidResponse('missing bundle component');
    required(options, row.option_id);
  }
  const mappedGroups = t.modifier_groups.filter(active).map(row => ({
    id: row.id, name: row.name, min: row.min_choices, max: row.max_choices, sourceGroupId: row.source_group_id ?? undefined, ...edited(row.id,'modifier_group'),
    options: t.modifier_options.filter(option => option.group_id === row.id && active(option)).map(option => ({
      id: option.id, name: option.name, price: displayDecimal(option.price, 2), defaultSelected: option.default_selected,
      inputs: t.modifier_stock_inputs.filter(input => input.option_id === option.id).map(input),
    })),
  } satisfies ModifierGroup));
  const stock: StockItem[] = t.stock_items.filter(active).map(row => {
    const unit = choice(row.unit_code, Object.keys(units) as (keyof typeof units)[]);
    const stockBatches = t.stock_batches.filter(batch => batch.stock_item_id === row.id && active(batch))
      .sort((a, b) => a.received_at.localeCompare(b.received_at) || a.id.localeCompare(b.id));
    // Add canonical decimals before converting, rather than accumulating binary floats.
    const total = stockBatches.reduce((sum, batch) => sum + scaledDecimal(required(balances, batch.id).quantity_base, 6), 0n);
    const decimalTotal = `${total / 1000000n}.${(total % 1000000n).toString().padStart(6, '0')}`;
    const batches = stockBatches.map((batch, i) => ({ id: batch.id, number: i + 1,
      quantity: displayDecimal(required(balances, batch.id).quantity_base, 6, units[unit]),
      manufactured: batch.manufactured_on ?? '', expires: batch.expires_on ?? '',
      status: row.unsellable || batch.unsellable ? 'Unsellable' : 'In Stock' }));
    const quantity = displayDecimal(decimalTotal, 6, units[unit]);
    const threshold = displayDecimal(row.threshold_base, 6, units[unit]);
    const usable = batches.filter(batch => batch.status !== 'Unsellable' && (!batch.expires || batch.expires >= snapshot.businessDate))
      .reduce((sum, batch) => sum + batch.quantity, 0);
    return { id: row.id, sku: skuFor(row.sku_id), name: row.name, kind: choice(row.kind, ['Ingredient', 'Finished'] as const),
      category: choice(row.category, categories), unit, quantity, threshold, batches, manufactured: '', expires: '', ...edited(row.id,'stock_item'),
      status: row.unsellable ? 'Unsellable' : quantity === 0 ? 'Out of Stock' : usable === 0 ? 'Expired / unusable' : usable <= threshold ? 'Low Stock' : 'In Stock' };
  });
  const products: Product[] = t.products.filter(active).map(row => {
    const model = choice(row.stock_model, Object.keys(models) as (keyof typeof models)[]);
    if (row.stock_item_id) required(stocks, row.stock_item_id);
    return { id: row.id, sku: skuFor(row.sku_id), name: row.name, category: choice(row.category, categories),
      mode: models[model], price: displayDecimal(row.base_price, 2), discountType: choice(row.discount_type, ['None', 'Fixed', 'Percentage'] as const),
      discountValue: displayDecimal(row.discount_value, 2), available: row.enabled, image: '', ...edited(row.id,'product'),
      icon: row.category === 'Hobby' ? 'hobby-solid.svg' : row.category === 'Beverage' ? 'b6984.svg' : 'a638b.svg',
      manufactured: row.manufactured_on ?? '', expires: row.expires_on ?? '', stockId: row.stock_item_id ?? undefined,
      recipe: t.product_recipe_items.filter(input => input.product_id === row.id).map(input),
      variants: t.product_variants.filter(variant => variant.product_id === row.id && active(variant)).map(variant => {
        const stock = required(stocks, variant.stock_item_id);
        return { id: variant.id, name: variant.name, stockId: stock.id, sku: skuFor(stock.sku_id),
          price: displayDecimal(variant.price, 2), available: variant.enabled && active(stock) };
      }),
      bundle: t.bundle_components.filter(component => component.bundle_product_id === row.id)
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).map(component => {
          if (Boolean(component.component_product_id) === Boolean(component.stock_item_id)) invalidResponse('bundle source');
          const child = component.component_product_id ? required(productRows, component.component_product_id) : undefined;
          const childStock = component.stock_item_id ? required(stocks, component.stock_item_id) : undefined;
          const variant = component.variant_id ? required(variants, component.variant_id) : undefined;
          if (variant && variant.product_id !== child?.id) invalidResponse('bundle variant ownership');
          const selected = t.bundle_component_modifiers.filter(value => value.component_id === component.id).map(value => value.option_id);
          if (selected.some(id => required(groups, required(options, id).group_id).product_id !== child?.id)) invalidResponse('bundle option ownership');
          return { productId: child?.id, stockId: childStock?.id ?? '', variantId: variant?.id, modifierIds: selected,
            name: child?.name ?? childStock!.name, sku: skuFor(child?.sku_id ?? childStock!.sku_id), quantity: component.quantity };
        }),
      modifiers: mappedGroups.filter(group => required(groups, group.id).product_id === row.id),
    };
  });
  for (const component of t.bundle_components) required(productRows, component.bundle_product_id);
  // Retain source revisions, image paths and provenance beside the display models.
  // P5 commands must select writable fields, never serialize a display object as SQL.
  return { source: snapshot, businessDate: snapshot.businessDate, stock, products,
    modifierTemplates: mappedGroups.filter(group => required(groups, group.id).product_id === null) };
}
