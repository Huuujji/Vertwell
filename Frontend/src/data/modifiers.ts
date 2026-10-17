import type { ModifierGroup, StockItem } from './demo';
import { convert } from './inventory';

// Copies own their identifiers and stock inputs. Library changes never propagate implicitly.
export function copyModifierGroup(group: ModifierGroup): ModifierGroup {
  return { id: crypto.randomUUID(), name: group.name, min: group.min, max: group.max, sourceGroupId: group.sourceGroupId,
    options: group.options.map(option => ({ ...option, id: crypto.randomUUID(), inputs: option.inputs.map(input => ({ ...input })) })) };
}
export function modifierError(group: ModifierGroup, items: StockItem[]): string | undefined {
  if (!group.name.trim() || !Number.isSafeInteger(group.min) || !Number.isSafeInteger(group.max) || group.min < 0 || group.max < group.min || group.max > group.options.length || !group.options.length || group.options.some(option => !option.name.trim() || !Number.isFinite(option.price) || option.price < 0 || option.inputs.some(input => {
    const stock = items.find(value => value.id === input.stockId);
    return !stock || !Number.isFinite(input.quantity) || input.quantity === 0 || !Number.isFinite(convert(input.quantity, input.unit, stock.unit));
  }))) return 'Check modifier names, prices, stock units, and minimum/maximum choices.';
  const defaults = group.options.filter(option => option.defaultSelected).length;
  if (defaults > group.max || defaults > 0 && defaults < group.min) return `Default selections in ${group.name} must meet its ${group.min}–${group.max} choice limits, or leave all defaults off.`;
}
