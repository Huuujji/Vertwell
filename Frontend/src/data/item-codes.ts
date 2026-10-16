import type { Category, Product, StockItem } from './demo';

export function generateItemCode(kind: 'Product' | 'Ingredient' | 'Stock', category: Category, mode: Product['mode'], records: (Product | StockItem)[]) {
  const model = kind === 'Ingredient' ? 'IN' : mode === 'Variants' ? 'PRV' : mode === 'Bundle' ? 'PRB' : mode === 'Made to order' ? 'PRC' : 'PRR';
  const prefix = `${model}-${category === 'Hobby' ? 'HB' : category === 'Food' ? 'FD' : 'BV'}-`;
  const used = new Set(records.flatMap(record => [record.id, record.sku ?? '', record.code ?? '', ...('variants' in record ? record.variants?.map(variant => variant.sku) ?? [] : [])]).map(value => value.toUpperCase()));
  for (let i = 1; i <= 9999; i++) { const code = `${prefix}${String(i).padStart(4, '0')}`; if (!used.has(code)) return code; }
  throw new Error(`All four-digit codes for ${prefix} are in use.`);
}
