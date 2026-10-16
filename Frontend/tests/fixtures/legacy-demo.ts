import { consumeStock, stockStatus, usageFor } from '../../src/data/inventory';
import { businessDate } from '../../src/data/business-date';
export { businessDate } from '../../src/data/business-date';

export type Category = 'Food' | 'Beverage' | 'Hobby';
export type Role = 'Owner' | 'Admin' | 'Staff';
export interface Batch { id: string; quantity: number; manufactured: string; expires: string; status: string }
export type DiscountType = 'None' | 'Fixed' | 'Percentage';
export interface RecipeInput { stockId: string; quantity: number; unit: string }
export interface ProductVariant { id: string; name: string; stockId: string; sku: string; price: number; available: boolean }
export interface BundleComponent { stockId: string; name: string; sku: string; quantity: number }
export interface Modifier { id: string; name: string; price: number; inputs: RecipeInput[]; defaultSelected?: boolean }
export interface ModifierGroup { id: string; name: string; min: number; max: number; options: Modifier[] }
export interface ModifierTemplate extends ModifierGroup { editedBy?: string; editedAt?: string }
export interface StockItem { id: string; sku?: string; code?: string; name: string; kind?: 'Ingredient' | 'Finished'; category: Category; quantity: number; unit: string; threshold?: number; image?: string; manufactured: string; expires: string; status: string; batches?: Batch[]; editedBy?: string; editedAt?: string }
export interface Product { id: string; sku?: string; code?: string; discountType?: DiscountType; discountValue?: number; name: string; category: Category; price: number; image: string; icon: string; mode?: 'Made to order' | 'Stocked' | 'Variants' | 'Bundle'; stockId?: string; recipe?: RecipeInput[]; variants?: ProductVariant[]; bundle?: BundleComponent[]; modifiers?: ModifierGroup[]; available?: boolean; editedBy?: string; editedAt?: string }
export interface Account { id: string; name: string; username: string; email: string; role: Role }
export interface VoidRequest { reason: string; requestedBy: string; requestedRole?: Role; requestedAt: string; status: 'Pending' | 'Approved' | 'Rejected'; reviewedBy?: string; reviewedRole?: Role; reviewedAt?: string }
export interface Consumption { kind?: 'Ingredient' | 'Finished'; stockId: string; sku?: string; name: string; quantity: number; unit: string }
export interface DailyReview { id: string; date: string; owner: string; role: 'Owner'; time: string; orderIds: string[]; expectedCash: number; expectedGCash: number; actualCash: number; actualGCash: number; countedCash: number; openingCash: number; additions: number; removals: number; refunds: number; explanation: string; outcome: 'Matched' | 'Reviewed with explained discrepancy' }
export interface Sale { id: string; time: string; cashier: string; cashierRole?: Role; cashierId?: string; paymentState?: 'Received'; fulfilmentState?: 'Fulfilled'; reviewState?: 'Awaiting Owner review' | 'Reviewed' | 'Owner checkout'; dailyReview?: DailyReview; status: 'Completed' | 'Pending' | 'Voided'; method: 'Cash' | 'GCash'; lines: { name: string; category: Category; quantity: number; price: number; originalPrice?: number; variant?: ProductVariant; bundle?: BundleComponent[]; modifiers?: { id: string; name: string; price: number }[]; recipe?: RecipeInput[]; usage?: Consumption[] }[]; usage?: Consumption[]; usageComplete?: boolean; stockCommitted?: boolean; total: number; reason?: string; reference?: string; voidRequest?: VoidRequest; voidedBy?: string; voidedRole?: Role; voidedAt?: string; bulkActionId?: string }
export const manilaTime = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
export const sellingPrice = (product: Product) => Math.round(Math.max(0, product.price - (product.discountType === 'Fixed' ? product.discountValue ?? 0 : product.discountType === 'Percentage' ? product.price * (product.discountValue ?? 0) / 100 : 0)) * 100) / 100;
export const products: Product[] = [
  // Illustrative per-serving recipes, not confirmed business recipes.
  { id: 'MML', name: 'Mango Matcha Latte', category: 'Beverage', price: 75, image: '9b1dc.png', icon: 'b6984.svg', mode: 'Made to order', recipe: [{ stockId: 'PT003', quantity: 4, unit: 'g' }, { stockId: 'PT002', quantity: 200, unit: 'ml' }, { stockId: 'IN-MANGO', quantity: 40, unit: 'g' }] },
  { id: 'BC', name: 'Buttered Croissant', category: 'Food', price: 75, image: '845c1.png', icon: 'a638b.svg', mode: 'Stocked', stockId: 'FD001' },
  { id: 'IML', name: 'Iced Matcha Latte', category: 'Beverage', price: 75, image: '43ad6.png', icon: 'b6984.svg', mode: 'Made to order', recipe: [{ stockId: 'PT003', quantity: 4, unit: 'g' }, { stockId: 'PT006', quantity: 200, unit: 'ml' }] },
  { id: 'JM', name: 'Japanese Mochi', category: 'Food', price: 75, image: '28033.png', icon: 'b6984.svg', mode: 'Stocked', stockId: 'FD009' },
  { id: 'MCP', name: 'Matcha Cookie Pack', category: 'Food', price: 75, image: '87cb5.png', icon: 'b6984.svg', mode: 'Stocked', stockId: 'FD010' },
  { id: 'CP', name: 'Card Pack', category: 'Hobby', price: 250, image: '6f622.png', icon: 'hobby-solid.svg', mode: 'Stocked', stockId: 'HB009' },
  { id: 'YGC', name: 'Yu-Gi-Oh! Card Set', category: 'Hobby', price: 450, image: '36fe0.png', icon: 'hobby-solid.svg', mode: 'Stocked', stockId: 'HB010' },
  { id: 'PCB', name: 'Pokémon Collection Box', category: 'Hobby', price: 1250, image: 'b7909.png', icon: 'hobby-solid.svg', mode: 'Stocked', stockId: 'HB002' },
  { id: 'PBP', name: 'Pokémon Booster Pack', category: 'Hobby', price: 250, image: '13a12.png', icon: 'hobby-solid.svg', mode: 'Stocked', stockId: 'HB001' },
];
products.push({ id: 'BURGER', name: 'Hamburger', category: 'Food', price: 120, image: '', icon: 'a638b.svg', mode: 'Made to order', recipe: [{ stockId: 'IN-BUN', quantity: 1, unit: 'pcs' }, { stockId: 'IN-PATTY', quantity: 1, unit: 'pcs' }, { stockId: 'IN-ONION', quantity: 20, unit: 'g' }], modifiers: [{ id: 'burger-extras', name: 'Customize your burger', min: 0, max: 2, options: [{ id: 'cheese', name: 'Extra cheese', price: 15, inputs: [{ stockId: 'FD007', quantity: 1, unit: 'pcs' }] }, { id: 'no-onions', name: 'No onions', price: 0, inputs: [{ stockId: 'IN-ONION', quantity: -20, unit: 'g' }] }] }] });
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
    item('PT003', 'Matcha', 'Beverage', 'Ingredient', 144, 'g', 150),
    item('PT002', 'Oat Milk', 'Beverage', 'Ingredient', 32.6, 'L', 5, 90, [
      { id: 'oat-1', quantity: 12.6, manufactured: '2026-08-01', expires: date(3), status: 'Fresh' },
      { id: 'oat-2', quantity: 20, manufactured: '2026-08-01', expires: date(30), status: 'Fresh' },
    ]),
    item('IN-MANGO', 'Mango puree', 'Beverage', 'Ingredient', 2120, 'g', 400),
    item('PT005', 'Caramel Syrup', 'Beverage', 'Ingredient', 1100, 'ml', 250),
    item('PT004', 'Sugar', 'Beverage', 'Ingredient', 100, 'g', 200),
    item('PT006', 'Milk', 'Beverage', 'Ingredient', 15.6, 'L', 3, 5),
    item('PT007', 'Chocolate Syrup', 'Beverage', 'Ingredient', 800, 'ml', 200),
    item('FD005', 'Flour', 'Food', 'Ingredient', 25, 'kg', 5),
    item('FD004', 'Chicken Pesto Panini', 'Food', 'Finished', 0, 'pcs', 5),
    item('FD008', 'Chocolate Chip Cookie', 'Food', 'Finished', 30, 'pcs', 5, 4),
    item('FD002', 'Blueberry Muffin', 'Food', 'Finished', 24, 'pcs', 5, 3),
    item('FD007', 'Cheese Slices', 'Food', 'Ingredient', 40, 'pcs', 10),
    item('FD001', 'Croissant', 'Food', 'Finished', 21, 'pcs', 5, 90, [
      { id: 'croissant-1', quantity: 8, manufactured: '2026-08-01', expires: date(-1), status: 'Expired' },
      { id: 'croissant-2', quantity: 13, manufactured: '2026-08-01', expires: date(4), status: 'Fresh' },
    ]),
    item('FD003', 'Ham and Cheese Sandwich', 'Food', 'Finished', 10, 'pcs', 5, 2),
    item('FD009', 'Japanese Mochi', 'Food', 'Finished', 25, 'pcs', 5, 30),
    item('FD010', 'Matcha Cookie Pack', 'Food', 'Finished', 30, 'pcs', 5),
    ...['Pokémon TCG Booster Pack', 'Pokémon Collection Box', 'One Piece Card Game Booster', 'Gundam RG', 'Gundam HG Kit', 'Gundam MG Kit', 'Poké Ball Replica (Standard)', 'Poké Ball Replica (Premium/Light-up)', 'Card Pack', 'Yu-Gi-Oh! Card Set'].map((name, i) => item(`HB${String(i + 1).padStart(3, '0')}`, name, 'Hobby', 'Finished', [45, 5, 30, 8, 3, 0, 15, 4, 25, 10][i], 'pcs', 5)),
  ];
  let stock = structuredClone(openingStock);
  const sales: Sale[] = [];
  function sale(id: string, time: string, actorId: string, productId: string, quantity: number, state: 'Completed' | 'Pending' | 'Voided', reference?: string, optionId?: string) {
    const actor = initialAccounts.find(account => account.id === actorId)!;
    const product = products.find(value => value.id === productId)!;
    const modifiers = product.modifiers?.flatMap(group => group.options).filter(option => option.id === optionId) ?? [];
    const result = usageFor([{ product, quantity, modifiers }], stock, businessDate(time));
    if (result.error) throw new Error(`Invalid demo sale ${id}: ${result.error}`);
    const price = sellingPrice(product) + modifiers.reduce((sum, option) => sum + option.price, 0);
    const reviewed = state === 'Completed' && actor.role !== 'Owner';
    const total = Math.round(price * quantity * 1.12 * 100) / 100;
    sales.push({ id, time, cashier: actor.name, cashierId: actor.id, cashierRole: actor.role, status: state, method: reference ? 'GCash' : 'Cash', reference, paymentState: 'Received', fulfilmentState: 'Fulfilled', reviewState: actor.role === 'Owner' ? 'Owner checkout' : reviewed ? 'Reviewed' : 'Awaiting Owner review', stockCommitted: true, usageComplete: true, usage: structuredClone(result.usage),
      lines: [{ name: product.name, category: product.category, quantity, price, originalPrice: price, modifiers: modifiers.map(({ id, name, price }) => ({ id, name, price })), recipe: [...(product.recipe ?? (product.stockId ? [{ stockId: product.stockId, quantity: 1, unit: 'pcs' }] : [])), ...modifiers.flatMap(option => option.inputs)], usage: structuredClone(result.usage) }], total,
      ...(reviewed ? { dailyReview: { id: `seed-review-${id}`, date: businessDate(time), owner: 'Angel', role: 'Owner', time: '2026-08-20T18:00:00+08:00', orderIds: [id], expectedCash: reference ? 0 : total, expectedGCash: reference ? total : 0, actualCash: reference ? 0 : total, actualGCash: reference ? total : 0, countedCash: reference ? 0 : total, openingCash: 0, additions: 0, removals: 0, refunds: 0, explanation: 'Illustrative matched seed receipt.', outcome: 'Matched' } as DailyReview } : {}),
      ...(state === 'Voided' ? { reason: 'Incorrect order entered', voidedBy: 'Alex', voidedRole: 'Admin' as const, voidedAt: '2026-08-20T14:00:00+08:00' } : {}),
    });
    stock = consumeStock(stock, result.usage, businessDate(time));
  }
  // Historical examples remain separate from today's per-person history.
  for (const [index, [actor, product]] of [['angel', 'BC'], ['alex', 'IML'], ['raven', 'MML'], ['micah', 'JM'], ['jestine', 'CP'], ['angel', 'MCP']].entries()) {
    sale(`20260820000${index + 1}`, `2026-08-20T${['13:15', '12:51', '11:40', '11:30', '10:25', '10:21'][index]}:00+08:00`, actor, product, 2, index === 4 ? 'Voided' : 'Completed');
  }
  // One current-Manila-day receipt per identity, with distinct stable actor IDs.
  sale(`${today.replaceAll('-', '')}00001`, `${today}T00:15:00+08:00`, 'angel', 'BC', 1, 'Completed');
  sale(`${today.replaceAll('-', '')}00002`, `${today}T00:25:00+08:00`, 'alex', 'JM', 1, 'Pending');
  sale(`${today.replaceAll('-', '')}00003`, `${today}T00:35:00+08:00`, 'raven', 'IML', 1, 'Pending', '9000000000001');
  sale(`${today.replaceAll('-', '')}00004`, `${today}T00:45:00+08:00`, 'micah', 'CP', 1, 'Pending');
  sale(`${today.replaceAll('-', '')}00005`, `${today}T00:55:00+08:00`, 'jestine', 'MML', 1, 'Pending', '9000000000002');
  // The receipt is fixed once at session start; role changes never rebuild sales.
  return { openingStock, stock: stock.map(item => ({ ...item, status: stockStatus(item) })), sales: sales.sort((a, b) => b.time.localeCompare(a.time)), products: structuredClone(products), accounts: structuredClone(initialAccounts) };
}
export const { stock: initialStock, sales: initialSales } = createDemoData();
export const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
export const dateLabel = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--';

