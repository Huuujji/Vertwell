import { sellingPrice } from './demo';
import type { BundleComponent, Modifier, Product, ProductVariant, StockItem } from './demo';
import { requirements, stockKind, usageFor } from './inventory';

export const finishedPieces = (items: StockItem[]) => items.filter(item => stockKind(item) === 'Finished' && item.unit === 'pcs');
export const variantPrice = (product: Product, variant?: ProductVariant) => variant?.price ?? product.price;
export const cataloguePrice = (product: Product) => product.mode === 'Variants' && product.variants?.length
  ? Math.min(...(product.variants.some(value => value.available) ? product.variants.filter(value => value.available) : product.variants).map(value => sellingPrice({ ...product, price: value.price }))) : sellingPrice(product);
// A card is available only if at least one valid configuration fits the stock
// remaining after the cart. Optional add-ons must not block a plain item, and a
// valid omission can make a recipe sellable even when its base ingredient is out.
export function productStockError(product: Product, stock: StockItem[], products?: Product[], otherLines: { product: Product; quantity: number; variant?: ProductVariant; modifiers?: Modifier[] }[] = []) {
  if (product.available === false) return `${product.name} is unavailable.`;
  const variants = product.mode === 'Variants' ? product.variants?.filter(value => value.available) ?? [] : [undefined];
  let error = product.mode === 'Variants' ? 'No variant has usable stock.' : 'No available modifier choices.';
  const groups = product.mode === 'Bundle' ? [] : product.modifiers ?? [];
  function* selections(groupIndex: number, selected: Modifier[]): Generator<Modifier[]> {
    const group = groups[groupIndex];
    if (!group) { yield selected; return; }
    function* combinations(index: number, chosen: Modifier[]): Generator<Modifier[]> {
      if (chosen.length >= group.min) yield* selections(groupIndex + 1, [...selected, ...chosen]);
      if (chosen.length >= group.max) return;
      for (let next = index; next < group.options.length; next++) yield* combinations(next + 1, [...chosen, group.options[next]]);
    }
    yield* combinations(0, []);
  }
  for (const variant of variants) for (const modifiers of selections(0, [])) {
    const result = usageFor([...otherLines, { product, quantity: 1, variant, modifiers }], stock, undefined, products);
    if (!result.error) return undefined;
    error = result.error;
  }
  return error;
}
export const bundleDescription = (bundle?: BundleComponent[]) => bundle?.map(value => `${value.quantity}× ${value.name} · ${value.sku}`).join('; ') ?? '';

// Prefer configured defaults, but only preselect a set that fits the whole order.
// Checking the set together accounts for shared SKUs, quantities and omissions.
export function availableDefaultIds(product: Product, stock: StockItem[], products: Product[], otherLines: { product: Product; quantity: number; variant?: ProductVariant; modifiers?: Modifier[] }[], quantity = 1, variant?: ProductVariant): string[] {
  if (product.mode === 'Variants' && !variant) return [];
  const defaults = product.modifiers?.flatMap(group => group.options.filter(option => option.defaultSelected)) ?? [];
  function select(index: number, choices: Modifier[]): string[] | undefined {
    if (index === defaults.length) return usageFor([...otherLines, { product, quantity, variant, modifiers: choices }], stock, undefined, products).error ? undefined : choices.map(option => option.id);
    return select(index + 1, [...choices, defaults[index]]) ?? select(index + 1, choices);
  }
  return select(0, []) ?? [];
}

export function configurationError(mode: Product['mode'], variants: ProductVariant[], bundle: BundleComponent[], items: StockItem[], products?: Product[], productId = 'new-bundle') {
  const stock = finishedPieces(items);
  if (mode === 'Variants') {
    if (!variants.length) return 'Add at least one variant linked to product stock.';
    if (variants.some(value => !value.name.trim() || !stock.some(item => item.id === value.stockId) || !Number.isFinite(value.price) || value.price <= 0)) return 'Each variant needs a name, positive price, and product stock in pieces.';
    if (new Set(variants.map(value => value.name.trim().toLowerCase())).size !== variants.length) return 'Variant names must be unique within this product.';
    if (new Set(variants.map(value => value.stockId)).size !== variants.length) return 'Each variant must use a different product-stock SKU.';
  }
  if (mode === 'Bundle') {
    if (!bundle.length) return 'Add at least one product to the bundle.';
    if (bundle.some(value => !value.productId && !stock.some(item => item.id === value.stockId) || !Number.isSafeInteger(value.quantity) || value.quantity <= 0)) return 'Choose a product and a positive whole-number quantity for every bundle component.';
    if (new Set(bundle.map(value => `${value.productId ?? value.stockId}:${value.variantId ?? ''}:${[...(value.modifierIds ?? [])].sort().join(',')}`)).size !== bundle.length) return 'Use each product configuration once; increase its quantity for multiple pieces.';
    try { requirements({ id: productId, name: 'Bundle', category: 'Food', price: 1, image: '', icon: '', mode: 'Bundle', bundle }, [], undefined, products); } catch (cause) { return cause instanceof Error ? cause.message : 'Check the included products.'; }
  }
}

export const catalogueMaximum = (product: Product) => product.mode === 'Variants' && product.variants?.length ? Math.max(...(product.variants.some(value => value.available) ? product.variants.filter(value => value.available) : product.variants).map(value => sellingPrice({ ...product, price: value.price }))) : sellingPrice(product);
