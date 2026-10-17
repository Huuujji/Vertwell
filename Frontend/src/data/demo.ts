import { consumeStock, requirements, stockStatus, usageFor } from './inventory';
import { businessDate } from './business-date';
export { businessDate } from './business-date';

export type Category = 'Food' | 'Beverage' | 'Hobby';
export type Role = 'Owner' | 'Admin' | 'Staff';
export interface Batch { number?: number; id: string; quantity: number; manufactured: string; expires: string; status: string }
export type DiscountType = 'None' | 'Fixed' | 'Percentage';
export interface RecipeInput { stockId: string; quantity: number; unit: string }
export interface ProductVariant { id: string; name: string; stockId: string; sku: string; price: number; available: boolean }
export interface BundleComponent { productId?: string; variantId?: string; modifierIds?: string[]; stockId: string; name: string; sku: string; quantity: number }
export interface Modifier { id: string; name: string; price: number; inputs: RecipeInput[]; defaultSelected?: boolean }
export interface ModifierGroup { id: string; name: string; min: number; max: number; options: Modifier[]; sourceGroupId?: string }
export interface ModifierTemplate extends ModifierGroup { editedBy?: string; editedAt?: string }
export interface StockItem { id: string; sku?: string; code?: string; name: string; kind?: 'Ingredient' | 'Finished'; category: Category; quantity: number; unit: string; threshold?: number; image?: string; manufactured: string; expires: string; status: string; batches?: Batch[]; editedBy?: string; editedAt?: string }
export interface Product { manufactured?: string; expires?: string; id: string; sku?: string; code?: string; discountType?: DiscountType; discountValue?: number; name: string; category: Category; price: number; image: string; icon: string; mode?: 'Made to order' | 'Stocked' | 'Variants' | 'Bundle'; stockId?: string; recipe?: RecipeInput[]; variants?: ProductVariant[]; bundle?: BundleComponent[]; modifiers?: ModifierGroup[]; available?: boolean; editedBy?: string; editedAt?: string }
export interface Account { id: string; name: string; username: string; email: string; role: Role; active?: boolean }
export interface VoidRequest { reason: string; requestedBy: string; requestedRole?: Role; requestedAt: string; status: 'Pending' | 'Approved' | 'Rejected'; reviewedBy?: string; reviewedRole?: Role; reviewedAt?: string }
export interface Consumption { kind?: 'Ingredient' | 'Finished'; stockId: string; sku?: string; name: string; quantity: number; unit: string }
export interface DailyReview { id: string; date: string; owner: string; role: 'Owner'; time: string; orderIds: string[]; expectedCash: number; expectedGCash: number; actualCash: number; actualGCash: number; countedCash: number; openingCash: number; additions: number; removals: number; refunds: number; explanation: string; outcome: 'Matched' | 'Reviewed with explained discrepancy' }
export interface Sale { id: string; time: string; cashier: string; cashierRole?: Role; cashierId?: string; paymentState?: 'Received'; fulfilmentState?: 'Fulfilled'; reviewState?: 'Awaiting Owner review' | 'Reviewed' | 'Owner checkout'; dailyReview?: DailyReview; status: 'Completed' | 'Pending' | 'Voided'; method: 'Cash' | 'GCash'; lines: { name: string; category: Category; quantity: number; price: number; originalPrice?: number; variant?: ProductVariant; bundle?: BundleComponent[]; modifiers?: { id: string; name: string; price: number }[]; recipe?: RecipeInput[]; usage?: Consumption[] }[]; usage?: Consumption[]; usageComplete?: boolean; stockCommitted?: boolean; total: number; reason?: string; reference?: string; voidRequest?: VoidRequest; voidedBy?: string; voidedRole?: Role; voidedAt?: string; bulkActionId?: string }
export const manilaTime = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
export const sellingPrice = (product: Product) => Math.round(Math.max(0, product.price - (product.discountType === 'Fixed' ? product.discountValue ?? 0 : product.discountType === 'Percentage' ? product.price * (product.discountValue ?? 0) / 100 : 0)) * 100) / 100;
export const products: Product[] = [
  // Food/Beverage may use recipes; Hobby uses Stocked, Variants, or Bundle only.
  // Recipes, prices and contents are illustrative mock assumptions.
  { id: 'PR-CARAMEL-LATTE', sku: 'PR-CARAMEL-LATTE', name: 'Iced Caramel Latte', category: 'Beverage', price: 75, image: '', icon: 'b6984.svg', mode: 'Made to order', recipe: [{ stockId: 'PT001', quantity: 18, unit: 'g' }, { stockId: 'PT006', quantity: 200, unit: 'ml' }, { stockId: 'PT005', quantity: 20, unit: 'ml' }] },
  { id: 'PR-BUTTER-COOKIE', sku: 'PR-BUTTER-COOKIE', name: 'Butter Cookie Pouch', category: 'Food', price: 75, image: '', icon: 'a638b.svg', mode: 'Stocked', stockId: 'FD001' },
  { id: 'PR-MANGO-SMOOTHIE', sku: 'PR-MANGO-SMOOTHIE', name: 'Mango Oat Smoothie', category: 'Beverage', price: 75, image: '', icon: 'b6984.svg', mode: 'Made to order', recipe: [{ stockId: 'PT002', quantity: 200, unit: 'ml' }, { stockId: 'IN-MANGO', quantity: 60, unit: 'g' }] },
  { id: 'PR-BEEF-SLIDERS', sku: 'PR-BEEF-SLIDERS', name: 'Grilled Beef Sliders', category: 'Food', price: 120, image: '', icon: 'a638b.svg', mode: 'Made to order', recipe: [{ stockId: 'IN-BUN', quantity: 1, unit: 'pcs' }, { stockId: 'IN-PATTY', quantity: 1, unit: 'pcs' }, { stockId: 'IN-ONION', quantity: 20, unit: 'g' }], modifiers: [{ id: 'slider-extras', name: 'Slider extras', min: 0, max: 2, options: [{ id: 'slider-cheese', name: 'Extra cheese', price: 15, inputs: [{ stockId: 'FD007', quantity: 1, unit: 'pcs' }] }, { id: 'slider-no-onions', name: 'No onions', price: 0, inputs: [{ stockId: 'IN-ONION', quantity: -20, unit: 'g' }] }] }] },
  { id: 'PR-COOKIE-BOX', sku: 'PR-COOKIE-BOX', name: 'Cookie Box Sizes', category: 'Food', price: 75, image: '', icon: 'a638b.svg', mode: 'Variants', variants: [
    { id: 'cookie-small', name: 'Small', stockId: 'FD010', sku: 'FD010', price: 75, available: true },
    { id: 'cookie-large', name: 'Large', stockId: 'FD009', sku: 'FD009', price: 150, available: true },
  ] },
  { id: 'PR-DECK-SLEEVES', sku: 'PR-DECK-SLEEVES', name: 'Deck Sleeves', category: 'Hobby', price: 250, image: '', icon: 'hobby-solid.svg', mode: 'Stocked', stockId: 'HB009' },
  { id: 'PR-CARD-BINDER', sku: 'PR-CARD-BINDER', name: 'Trading Card Binder', category: 'Hobby', price: 450, image: '', icon: 'hobby-solid.svg', mode: 'Stocked', stockId: 'HB010' },
  { id: 'PR-MODEL-KIT', sku: 'PR-MODEL-KIT', name: 'Model Kit Editions', category: 'Hobby', price: 750, image: '', icon: 'hobby-solid.svg', mode: 'Variants', variants: [
    { id: 'kit-standard', name: 'Standard', stockId: 'HB004', sku: 'HB004', price: 750, available: true },
    { id: 'kit-deluxe', name: 'Deluxe', stockId: 'HB005', sku: 'HB005', price: 1250, available: true },
  ] },
  { id: 'PR-TABLETOP-STARTER', sku: 'PR-TABLETOP-STARTER', name: 'Tabletop Starter Bundle', category: 'Hobby', price: 500, image: '', icon: 'hobby-solid.svg', mode: 'Bundle', bundle: [
    { stockId: 'HB009', name: 'Deck Sleeves', sku: 'HB009', quantity: 2 },
    { stockId: 'HB010', name: 'Trading Card Binder', sku: 'HB010', quantity: 1 },
  ] },
  { id: 'PR-CAFE-SNACK', sku: 'PR-CAFE-SNACK', name: 'Cafe Snack Bundle', category: 'Food', price: 140, image: '', icon: 'a638b.svg', mode: 'Bundle', bundle: [
    { stockId: 'BV001', name: 'Bottled Cold Brew', sku: 'BV001', quantity: 1 },
    { stockId: 'FD010', name: 'Cookie Box (Small)', sku: 'FD010', quantity: 1 },
  ] },
];
export const initialAccounts: Account[] = [
  { id: 'angel', name: 'Angel', username: 'angel', email: 'angel@example.com', role: 'Owner' },
  { id: 'alex', name: 'Alex', username: 'alex', email: 'alex@example.com', role: 'Admin' },
  { id: 'raven', name: 'Raven', username: 'raven', email: 'raven@example.com', role: 'Staff' },
  { id: 'micah', name: 'Micah', username: 'micah', email: 'micah@example.com', role: 'Staff' },
  { id: 'jestine', name: 'Jestine', username: 'jestine', email: 'jestine@example.com', role: 'Staff' },
];

// Each refresh creates one independent mock session. Receipt quantities are opening
// stock; every fulfilled seed sale is applied once, including the voided sale.
// This fixture ledger is not a historical business opening/closing balance.
export function createDemoData() {
  const today = businessDate();
  const date = (offset: number) => new Date(new Date(`${today}T00:00:00Z`).getTime() + offset * 86400000).toISOString().slice(0, 10);
  const item = (id: string, name: string, category: Category, kind: 'Ingredient' | 'Finished', quantity: number, unit: string, threshold: number, expiry = 90, batches?: Batch[]): StockItem => ({ id, sku: id, name, category, kind, quantity, unit, threshold, manufactured: batches ? '' : '2026-08-01', expires: batches ? '' : kind === 'Finished' && category === 'Hobby' ? '' : date(expiry), status: 'In Stock', batches });
  const openingStock: StockItem[] = [
    item('IN-BUN', 'Burger buns', 'Food', 'Ingredient', 20, 'pcs', 5),
    item('IN-PATTY', 'Burger patties', 'Food', 'Ingredient', 20, 'pcs', 5),
    item('IN-ONION', 'Onions', 'Food', 'Ingredient', 500, 'g', 100),
    item('PT001', 'Espresso beans', 'Beverage', 'Ingredient', 4, 'kg', 1),
    item('PT003', 'Matcha', 'Beverage', 'Ingredient', 120, 'g', 150),
    item('PT002', 'Oat Milk', 'Beverage', 'Ingredient', 32, 'L', 5, 90, [
      { id: 'oat-1', quantity: 12, manufactured: '2026-08-01', expires: date(3), status: 'Fresh' },
      { id: 'oat-2', quantity: 20, manufactured: '2026-08-01', expires: date(30), status: 'Fresh' },
    ]),
    item('IN-MANGO', 'Mango puree', 'Beverage', 'Ingredient', 2000, 'g', 400),
    item('PT005', 'Caramel Syrup', 'Beverage', 'Ingredient', 1100, 'ml', 250),
    item('PT004', 'Sugar', 'Beverage', 'Ingredient', 100, 'g', 200),
    item('PT006', 'Milk', 'Beverage', 'Ingredient', 15, 'L', 3, 5),
    item('PT007', 'Chocolate Syrup', 'Beverage', 'Ingredient', 800, 'ml', 200),
    item('FD005', 'Flour', 'Food', 'Ingredient', 25, 'kg', 5),
    item('FD004', 'Chicken Pesto Panini', 'Food', 'Finished', 0, 'pcs', 5),
    item('FD008', 'Chocolate Chip Cookie', 'Food', 'Finished', 30, 'pcs', 5, 4),
    item('FD002', 'Blueberry Muffin', 'Food', 'Finished', 24, 'pcs', 5, 3),
    item('FD007', 'Cheese Slices', 'Food', 'Ingredient', 40, 'pcs', 10),
    item('FD001', 'Butter Cookie Pouch', 'Food', 'Finished', 21, 'pcs', 5, 90, [
      { id: 'butter-cookie-1', quantity: 8, manufactured: '2026-08-01', expires: date(-1), status: 'Expired' },
      { id: 'butter-cookie-2', quantity: 13, manufactured: '2026-08-01', expires: date(4), status: 'Fresh' },
    ]),
    item('FD003', 'Ham and Cheese Sandwich', 'Food', 'Finished', 10, 'pcs', 5, 2),
    item('FD009', 'Cookie Box (Large)', 'Food', 'Finished', 25, 'pcs', 5, 30),
    item('FD010', 'Cookie Box (Small)', 'Food', 'Finished', 30, 'pcs', 5),
    item('BV001', 'Bottled Cold Brew', 'Beverage', 'Finished', 35, 'pcs', 5, 30),
    item('BV002', 'Sparkling Apple Juice', 'Beverage', 'Finished', 35, 'pcs', 5, 30),
    ...['Collector Booster Pack', 'Collector Storage Box', 'Adventure Booster Pack', 'Model Kit (Standard)', 'Model Kit (Deluxe)', 'Model Kit (Master)', 'Display Figure (Standard)', 'Display Figure (Premium)', 'Deck Sleeves', 'Trading Card Binder'].map((name, i) => item(`HB${String(i + 1).padStart(3, '0')}`, name, 'Hobby', 'Finished', [45, 5, 30, 8, 3, 0, 15, 4, 25, 10][i], 'pcs', 5)),
  ];
  let stock = structuredClone(openingStock);
  const sales: Sale[] = [];
  function sale(id: string, time: string, actorId: string, productId: string, quantity: number, state: 'Completed' | 'Pending' | 'Voided', reference?: string, variantId?: string) {
    const actor = initialAccounts.find(account => account.id === actorId)!;
    const product = products.find(value => value.id === productId)!;
    const variant = product.variants?.find(value => value.id === variantId);
    const result = usageFor([{ product, quantity, variant }], stock, businessDate(time));
    if (result.error) throw new Error(`Invalid demo sale ${id}: ${result.error}`);
    const price = sellingPrice({ ...product, price: variant?.price ?? product.price });
    const reviewed = state === 'Completed' && actor.role !== 'Owner';
    const total = Math.round(price * quantity * 1.12 * 100) / 100;
    sales.push({ id, time, cashier: actor.name, cashierId: actor.id, cashierRole: actor.role, status: state, method: reference ? 'GCash' : 'Cash', reference, paymentState: 'Received', fulfilmentState: 'Fulfilled', reviewState: actor.role === 'Owner' ? 'Owner checkout' : reviewed ? 'Reviewed' : 'Awaiting Owner review', stockCommitted: true, usageComplete: true, usage: structuredClone(result.usage),
      lines: [{ name: `${product.name}${variant ? ` — ${variant.name}` : ''}`, category: product.category, quantity, price, originalPrice: price, variant: variant ? { ...variant } : undefined, bundle: product.bundle ? structuredClone(product.bundle) : undefined, recipe: requirements(product, [], variant), usage: structuredClone(result.usage) }], total,
      ...(reviewed ? { dailyReview: { id: `seed-review-${id}`, date: businessDate(time), owner: 'Angel', role: 'Owner', time: '2026-08-20T18:00:00+08:00', orderIds: [id], expectedCash: reference ? 0 : total, expectedGCash: reference ? total : 0, actualCash: reference ? 0 : total, actualGCash: reference ? total : 0, countedCash: reference ? 0 : total, openingCash: 0, additions: 0, removals: 0, refunds: 0, explanation: 'Illustrative matched seed receipt.', outcome: 'Matched' } as DailyReview } : {}),
      ...(state === 'Voided' ? { reason: 'Incorrect order entered', voidedBy: 'Alex', voidedRole: 'Admin' as const, voidedAt: '2026-08-20T14:00:00+08:00' } : {}),
    });
    stock = consumeStock(stock, result.usage, businessDate(time));
  }
  // Historical examples remain separate from today's per-person history.
  for (const [index, [actor, product, variant]] of [['angel', 'PR-BUTTER-COOKIE'], ['alex', 'PR-MODEL-KIT', 'kit-standard'], ['raven', 'PR-CAFE-SNACK'], ['micah', 'PR-BEEF-SLIDERS'], ['jestine', 'PR-DECK-SLEEVES'], ['angel', 'PR-COOKIE-BOX', 'cookie-small']].entries()) {
    sale(`20260820000${index + 1}`, `2026-08-20T${['13:15', '12:51', '11:40', '11:30', '10:25', '10:21'][index]}:00+08:00`, actor, product, 2, index === 4 ? 'Voided' : 'Completed', undefined, variant);
  }
  // One current-Manila-day receipt per identity, with distinct stable actor IDs.
  sale(`${today.replaceAll('-', '')}00001`, `${today}T00:15:00+08:00`, 'angel', 'PR-BUTTER-COOKIE', 1, 'Completed');
  sale(`${today.replaceAll('-', '')}00002`, `${today}T00:25:00+08:00`, 'alex', 'PR-BEEF-SLIDERS', 1, 'Pending');
  sale(`${today.replaceAll('-', '')}00003`, `${today}T00:35:00+08:00`, 'raven', 'PR-MANGO-SMOOTHIE', 1, 'Pending', '9000000000001');
  sale(`${today.replaceAll('-', '')}00004`, `${today}T00:45:00+08:00`, 'micah', 'PR-DECK-SLEEVES', 1, 'Pending');
  sale(`${today.replaceAll('-', '')}00005`, `${today}T00:55:00+08:00`, 'jestine', 'PR-CARAMEL-LATTE', 1, 'Pending', '9000000000002');
  // The receipt is fixed once at session start; role changes never rebuild sales.
  return { openingStock, stock: stock.map(item => ({ ...item, status: stockStatus(item) })), sales: sales.sort((a, b) => b.time.localeCompare(a.time)), products: structuredClone(products), accounts: structuredClone(initialAccounts) };
}
export const { stock: initialStock, sales: initialSales } = createDemoData();
export const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
export const dateLabel = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--';
