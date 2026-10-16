-- Opt-in disposable-development fixtures. Never run from an automatic deploy.
begin;
do $$ begin
  if current_setting('vertwell.allow_development_seed', true) is distinct from 'on' then
    raise exception 'Development seed disabled. Set vertwell.allow_development_seed=on only in a disposable development database.';
  end if;
end $$;

insert into public.skus(id,value) values
  ('10000000-0000-4000-8000-000000000001','DEV-IN-BV-0001'),
  ('10000000-0000-4000-8000-000000000002','DEV-PRR-HB-0001'),
  ('10000000-0000-4000-8000-000000000003','DEV-PRC-BV-0001');
insert into public.stock_items(id,sku_id,name,kind,category,unit_code,threshold_base) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Development coffee beans','Ingredient','Beverage','g',100),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Development card sleeves','Finished','Hobby','pcs',5);
insert into public.stock_batches(stock_item_id,manufactured_on,expires_on) values
  ('20000000-0000-4000-8000-000000000001',current_date,current_date+30),
  ('20000000-0000-4000-8000-000000000002',null,null);
insert into public.products(id,sku_id,name,category,stock_model,stock_item_id,base_price,manufactured_on,expires_on) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Development sleeves','Hobby','Retail Item','20000000-0000-4000-8000-000000000002',50,null,null),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','Development coffee','Beverage','Recipe',null,75,current_date,current_date+1);
insert into public.product_recipe_items(product_id,stock_item_id,quantity,unit_code) values
  ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',18,'g');
-- Empty batches intentionally have no invented opening balance or actor.
-- Receive real opening quantities through the later protected inventory command.
commit;
