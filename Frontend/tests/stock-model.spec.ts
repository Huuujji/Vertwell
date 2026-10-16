import { test, expect } from './fixtures/legacy-preview';
import { consumeStock, usageFor } from '../src/data/inventory';
import type { Product, StockItem } from '../src/data/demo';

test('unit conversion and ingredient omissions are limited to the configured cart line', () => {
  const stock: StockItem[] = [{ id: 'onion', name: 'Onion', category: 'Food', quantity: 1, unit: 'kg', manufactured: '', expires: '', status: 'In Stock' }];
  const product: Product = { id: 'burger', name: 'Burger', category: 'Food', price: 100, image: '', icon: '', mode: 'Made to order', recipe: [{ stockId: 'onion', quantity: 20, unit: 'g' }] };
  const omitted = { id: 'no-onions', name: 'No onions', price: 0, inputs: [{ stockId: 'onion', quantity: -200, unit: 'g' }] };
  const result = usageFor([{ product, quantity: 2 }, { product, quantity: 1, modifiers: [omitted] }], stock);
  expect(result.error).toBeUndefined(); expect(result.usage[0].quantity).toBe(.04);
  expect(usageFor([{ product: { ...product, recipe: [{ stockId: 'onion', quantity: 1, unit: 'L' }] }, quantity: 1 }], stock).error).toContain('unit');
});

test('expiry-aware stock consumption uses the nearest usable expiry and preserves expired batches', () => {
  const stock: StockItem[] = [{ id: 'stock', name: 'Input', category: 'Food', quantity: 12, unit: 'pcs', manufactured: '', expires: '', status: 'In Stock', batches: [
    { id: 'later', quantity: 5, manufactured: '', expires: '2099-12-31', status: 'Fresh' },
    { id: 'expired', quantity: 3, manufactured: '', expires: '2000-01-01', status: 'Expired' },
    { id: 'earlier', quantity: 4, manufactured: '', expires: '2099-01-01', status: 'Fresh' },
  ] }];
  const product: Product = { id: 'product', name: 'Product', category: 'Food', price: 100, image: '', icon: '', mode: 'Stocked', stockId: 'stock' };
  expect(usageFor([{ product, quantity: 10 }], stock).error).toContain('usable');
  const result = consumeStock(stock, usageFor([{ product, quantity: 6 }], stock).usage);
  expect(result[0].quantity).toBe(6); expect(result[0].batches?.find(batch => batch.id === 'earlier')?.quantity).toBe(0); expect(result[0].batches?.find(batch => batch.id === 'later')?.quantity).toBe(3); expect(result[0].batches?.find(batch => batch.id === 'expired')?.quantity).toBe(3);
  expect(stock[0].quantity).toBe(12); expect(stock[0].batches?.find(batch => batch.id === 'earlier')?.quantity).toBe(4);
});
