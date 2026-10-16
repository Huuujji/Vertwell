import type { Locator } from '@playwright/test';

export async function chooseSearch(field: Locator, value: string) {
  const input = field.and(field.page().getByRole('combobox'));
  await input.click();
  await input.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " search-select ")]').locator(`[role="option"][data-value="${value}"]`).click();
}
