import { businessDate } from './business-date';
import type { Consumption, Modifier, Product, ProductVariant, RecipeInput, StockItem } from './demo';

// Quantity conversions are limited to compatible, explicit stock units.
const units: Record<string, { family: string; factor: number }> = { g: { family: 'mass', factor: 1 }, kg: { family: 'mass', factor: 1000 }, ml: { family: 'volume', factor: 1 }, L: { family: 'volume', factor: 1000 }, pcs: { family: 'count', factor: 1 }, bottles: { family: 'bottle', factor: 1 } };
export function convert(quantity: number, from: string, to: string) {
  if (from === to) return quantity;
  const a = units[from], b = units[to];
  return a && b && a.family === b.family ? quantity * a.factor / b.factor : NaN;
}
export const stockKind = (item: StockItem) => item.kind ?? (/^(PT|FD005|FD007)/.test(item.id) ? 'Ingredient' : 'Finished');
export const stockStatus = (item: StockItem) => item.quantity <= 0 ? 'Out of Stock' : usableQuantity(item) <= 0 ? 'Expired / unusable' : item.quantity <= (item.threshold ?? 5) ? 'Low Stock' : 'In Stock';
export function usableQuantity(item: StockItem, asOf = businessDate()) {
  const usable = (expires: string) => !expires || expires >= asOf;
  if (item.status === 'Unsellable') return 0;
  return Math.max(0, Math.min(item.quantity, item.batches ? item.batches.filter(batch => usable(batch.expires) && batch.status !== 'Unsellable').reduce((sum, batch) => sum + batch.quantity, 0) : usable(item.expires) ? item.quantity : 0));
}
export const removalQuantity = (item: StockItem) => Math.max(0, Math.round((item.quantity - usableQuantity(item)) * 1e6) / 1e6);
export function removeUnusableStock(item: StockItem) {
  const quantity = usableQuantity(item);
  const batches = item.batches?.map(batch => ({ ...batch, quantity: item.status === 'Unsellable' || batch.status === 'Unsellable' || batch.expires && batch.expires < businessDate() ? 0 : batch.quantity }));
  const next = { ...item, quantity, batches, status: '' };
  return { ...next, status: stockStatus(next) };
}
export function requirements(product: Product, modifiers: Modifier[] = [], variant?: ProductVariant, catalogue?: Product[], trail: string[] = []): RecipeInput[] {
  if (trail.includes(product.id)) throw new Error('A bundle cannot include itself, directly or through another bundle.');
  const base = product.mode === 'Variants' ? variant ? [{ stockId: variant.stockId, quantity: 1, unit: 'pcs' }] : []
    : product.mode === 'Bundle' ? (product.bundle ?? []).flatMap(component => {
      if (!Number.isSafeInteger(component.quantity) || component.quantity <= 0) throw new Error('Bundle quantities must be positive whole numbers.');
      if (!component.productId) return [{ stockId: component.stockId, quantity: component.quantity, unit: 'pcs' }];
      const child = catalogue?.find(value => value.id === component.productId);
      if (!child || child.available === false || !child.mode) throw new Error(`${component.name} is missing or unavailable. Edit the bundle before selling.`);
      const chosenVariant = child.variants?.find(value => value.id === component.variantId);
      if (child.mode === 'Variants' && (!chosenVariant || !chosenVariant.available)) throw new Error(`Choose an available variant of ${child.name} in the bundle.`);
      const options = child.modifiers?.flatMap(group => group.options).filter(option => component.modifierIds?.includes(option.id)) ?? [];
      if (component.modifierIds?.some(id => !options.some(option => option.id === id)) || child.modifiers?.some(group => { const count = options.filter(option => group.options.some(value => value.id === option.id)).length; return count < group.min || count > group.max; })) throw new Error(`Check the included options for ${child.name}.`);
      const childInputs = requirements(child, options, chosenVariant, catalogue, [...trail, product.id]);
      const normalized = new Map<string, RecipeInput>();
      childInputs.forEach(input => { const previous = normalized.get(input.stockId); normalized.set(input.stockId, { ...input, unit: previous?.unit ?? input.unit, quantity: (previous?.quantity ?? 0) + convert(input.quantity, input.unit, previous?.unit ?? input.unit) }); });
      return [...normalized.values()].map(input => ({ ...input, quantity: Math.max(0, input.quantity) * component.quantity }));
    })
    : product.mode === 'Stocked' && product.stockId ? [{ stockId: product.stockId, quantity: 1, unit: 'pcs' }] : product.recipe ?? [];
  return [...base, ...modifiers.flatMap(option => option.inputs)];
}
// Shared by cart validation and the final payment boundary. Normalize before
// checking availability so duplicate inputs cannot draw from the same stock twice.
export function validateStockUsage(inputs: Consumption[], stock: StockItem[], asOf = businessDate()): { usage: Consumption[]; error?: string } {
  const totals = new Map<string, Consumption>();
  for (const input of inputs) {
    const item = stock.find(value => value.id === input.stockId);
    if (!item) return { usage: [], error: 'A recipe references a missing stock record. Edit the product before selling.' };
    const quantity = convert(input.quantity, input.unit, item.unit);
    if (!Number.isFinite(quantity) || quantity < 0) return { usage: [], error: `Check the stock quantity and compatible unit for ${item.name}.` };
    const current = totals.get(item.id) ?? { ...input, name: item.name, unit: item.unit, quantity: 0 };
    current.quantity += quantity;
    totals.set(item.id, current);
  }
  const usage = [...totals.values()];
  for (const input of usage) {
    const item = stock.find(value => value.id === input.stockId)!;
    const available = usableQuantity(item, asOf);
    if (!Number.isFinite(item.quantity) || item.quantity < 0 || !Number.isFinite(available) || item.batches?.some(batch => !Number.isFinite(batch.quantity) || batch.quantity < 0) || !Number.isFinite(input.quantity)) return { usage: [], error: `Check the stock quantity for ${item.name}.` };
    if (input.quantity > available) return { usage, error: `Not enough usable ${item.name}. ${available} ${item.unit} available; ${input.quantity} needed. Expired or unsellable batches cannot be sold.` };
  }
  return { usage };
}
export function usageFor(lines: { product: Product; quantity: number; modifiers?: Modifier[]; variant?: ProductVariant }[], stock: StockItem[], asOf = businessDate(), catalogue?: Product[]): { usage: Consumption[]; error?: string } {
  const totals = new Map<string, Consumption>();
  for (const line of lines) {
    const lineTotals = new Map<string, Consumption>();
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) return { usage: [], error: 'Enter a positive whole-number order quantity.' };
    if (line.product.available === false) return { usage: [], error: `${line.product.name} is unavailable.` };
    if (line.product.mode === 'Variants' && (!line.variant || !line.product.variants?.some(value => value.id === line.variant!.id))) return { usage: [], error: `Choose a variant of ${line.product.name}.` };
    const fixedIds = line.product.mode === 'Variants' ? [line.variant!.stockId] : line.product.mode === 'Bundle' ? (line.product.bundle ?? []).filter(value => !value.productId).map(value => value.stockId) : [];
    if (fixedIds.some(id => { const item = stock.find(value => value.id === id); return !item || stockKind(item) !== 'Finished' || item.unit !== 'pcs'; })) return { usage: [], error: 'Variants and bundles require product stock in pieces. Edit the product before selling.' };
    if (line.variant?.available === false) return { usage: [], error: `${line.variant.name} is unavailable.` };
    if (line.product.mode === 'Bundle' && (!line.product.bundle?.length || line.product.bundle.some(value => !Number.isSafeInteger(value.quantity) || value.quantity <= 0))) return { usage: [], error: 'Check the bundle components before selling.' };
    if ((line.product.mode === 'Bundle' || line.product.mode === 'Variants') && line.modifiers?.some(option => option.inputs.some(input => input.quantity < 0))) return { usage: [], error: 'Variant and bundle add-ons cannot remove their product stock.' };
    let inputs: RecipeInput[];
    try { inputs = requirements(line.product, line.modifiers, line.variant, catalogue); } catch (cause) { return { usage: [], error: cause instanceof Error ? cause.message : 'Check the bundle configuration.' }; }
    for (const input of inputs) {
      const item = stock.find(value => value.id === input.stockId);
      if (!item) return { usage: [], error: 'A recipe references a missing stock record. Edit the product before selling.' };
      if ((line.product.mode === 'Bundle' || line.product.mode === 'Variants') && (!Number.isFinite(input.quantity) || input.quantity < 0)) return { usage: [], error: 'Check the configured stock quantities before selling.' };
      const quantity = convert(input.quantity, input.unit, item.unit) * line.quantity;
      if (!Number.isFinite(quantity)) return { usage: [], error: `Check the recipe unit for ${item.name}.` };
      const current = lineTotals.get(item.id) ?? { kind: stockKind(item), stockId: item.id, sku: item.sku ?? item.id, name: item.name, quantity: 0, unit: item.unit };
      current.quantity += quantity; lineTotals.set(item.id, current);
    }
    // An omission can remove this line's requirement, never another line's stock.
    lineTotals.forEach(input => { const current = totals.get(input.stockId) ?? { ...input, quantity: 0 }; current.quantity += Math.max(0, input.quantity); totals.set(input.stockId, current); });
  }
  const usage = [...totals.values()].map(item => ({ ...item, quantity: Math.round(Math.max(0, item.quantity) * 1e6) / 1e6 }));
  return validateStockUsage(usage, stock, asOf);
}
export function consumeStock(stock: StockItem[], usage: Consumption[], asOf = businessDate()) {
  const checked = validateStockUsage(usage, stock, asOf);
  if (checked.error) return stock;
  return stock.map(item => {
    const input = checked.usage.find(value => value.stockId === item.id);
    if (!input || !input.quantity) return item;
    let remaining = input.quantity;
    const batches = item.batches?.map((batch, index) => ({ ...batch, number: batch.number ?? index + 1 })).sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999'));
    batches?.forEach(batch => {
      if (batch.status === 'Unsellable' || batch.expires && batch.expires < asOf) return;
      const taken = Math.min(remaining, batch.quantity); batch.quantity = Math.round((batch.quantity - taken) * 1e6) / 1e6; remaining = Math.round((remaining - taken) * 1e6) / 1e6;
    });
    const updated = { ...item, quantity: Math.round((item.quantity - input.quantity) * 1e6) / 1e6, batches };
    return { ...updated, status: stockStatus(updated) };
  });
}
