export { businessDate } from './business-date';

export type Category = 'Food' | 'Beverage' | 'Hobby';
export type Role = 'Owner' | 'Admin' | 'Staff';
export interface Batch { number?: number; id: string; quantity: number; manufactured: string; expires: string; status: string }
export type DiscountType = 'None' | 'Fixed' | 'Percentage';
export interface RecipeInput { stockId: string; quantity: number; unit: string }
export interface ProductVariant { id: string; name: string; stockId: string; sku: string; price: number; available: boolean }
export interface BundleComponent { productId?: string; variantId?: string; modifierIds?: string[]; stockId: string; name: string; sku: string; quantity: number }
export interface Modifier { id: string; name: string; price: number; inputs: RecipeInput[]; defaultSelected?: boolean }
export interface ModifierGroup { createdAt?: string; id: string; name: string; min: number; max: number; options: Modifier[]; sourceGroupId?: string }
export interface ModifierTemplate extends ModifierGroup { createdAt?: string; addedAt?: string; editedBy?: string; editedAt?: string }
export interface StockItem { id: string; sku?: string; code?: string; name: string; kind?: 'Ingredient' | 'Finished'; category: Category; quantity: number; unit: string; threshold?: number; image?: string; manufactured: string; expires: string; status: string; batches?: Batch[]; createdAt?: string; addedAt?: string; editedBy?: string; editedAt?: string }
export interface Product { manufactured?: string; expires?: string; id: string; sku?: string; code?: string; discountType?: DiscountType; discountValue?: number; name: string; category: Category; price: number; image: string; icon: string; mode?: 'Made to order' | 'Stocked' | 'Variants' | 'Bundle'; stockId?: string; recipe?: RecipeInput[]; variants?: ProductVariant[]; bundle?: BundleComponent[]; modifiers?: ModifierGroup[]; available?: boolean; createdAt?: string; addedAt?: string; editedBy?: string; editedAt?: string }
export interface Account { id: string; name: string; username: string; email: string; role: Role; active?: boolean; createdAt?: string }
export interface VoidRequest { reason: string; requestedBy: string; requestedRole?: Role; requestedAt: string; status: 'Pending' | 'Approved' | 'Rejected'; reviewedBy?: string; reviewedRole?: Role; reviewedAt?: string }
export interface Consumption { kind?: 'Ingredient' | 'Finished'; stockId: string; sku?: string; name: string; quantity: number; unit: string }
export interface DailyReview { id: string; date: string; owner: string; role: 'Owner'; time: string; orderIds: string[]; expectedCash: number; expectedGCash: number; actualCash: number; actualGCash: number; countedCash: number; openingCash: number; additions: number; removals: number; refunds: number; explanation: string; outcome: 'Matched' | 'Reviewed with discrepancy' | 'Reviewed with explained discrepancy' }
export interface Sale { id: string; time: string; cashier: string; cashierRole?: Role; cashierId?: string; paymentState?: 'Received'; fulfilmentState?: 'Fulfilled'; reviewState?: 'Awaiting Owner review' | 'Reviewed' | 'Owner checkout'; dailyReview?: DailyReview; status: 'Completed' | 'Pending' | 'Voided'; method: 'Cash' | 'GCash' | 'Unrecorded'; lines: { name: string; category: Category; quantity: number; price: number; originalPrice?: number; purchasedConfiguration?: unknown; variant?: ProductVariant; bundle?: BundleComponent[]; modifiers?: { id: string; name: string; price: number }[]; recipe?: RecipeInput[]; usage?: Consumption[] }[]; usage?: Consumption[]; usageComplete?: boolean; stockCommitted?: boolean; total: number; reason?: string; reference?: string; voidRequest?: VoidRequest; voidedBy?: string; voidedRole?: Role; voidedAt?: string; bulkActionId?: string }
export const manilaTime = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
export const sellingPrice = (product: Product) => Math.round(Math.max(0, product.price - (product.discountType === 'Fixed' ? product.discountValue ?? 0 : product.discountType === 'Percentage' ? product.price * (product.discountValue ?? 0) / 100 : 0)) * 100) / 100;
export const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
export const dateLabel = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--';
