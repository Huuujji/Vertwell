-- CLI-generated follow-up; timestamp normalized to the project's Manila date
-- so it follows the previously applied October 17 legacy-numbered migrations.
begin;
create index stock_items_unit_fk on public.stock_items(unit_code);
create index recipe_items_unit_fk on public.product_recipe_items(unit_code);
create index modifier_inputs_unit_fk on public.modifier_stock_inputs(unit_code);
create index sale_usage_unit_fk on public.sale_item_stock_usage(unit_code);
create index stock_movements_unit_fk on public.stock_movements(unit_code);
commit;
