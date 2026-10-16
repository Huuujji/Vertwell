-- P2: single-business foundation. No preview identities/sales or role grants.
-- Apply in order to a Supabase development database, using the migration owner.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create domain public.money_amount as numeric(14,2)
  check (value >= 0 and value <> 'NaN'::numeric);
create domain public.stock_quantity as numeric(20,6)
  check (value <> 'NaN'::numeric);

create table public.inventory_units (
  code text primary key,
  family text not null check (family in ('mass','volume','count','bottle')),
  factor numeric(12,3) not null check (factor > 0 and factor <> 'NaN'::numeric)
);
insert into public.inventory_units values
  ('g','mass',1), ('kg','mass',1000), ('ml','volume',1),
  ('L','volume',1000), ('pcs','count',1), ('bottles','bottle',1);

create table public.skus (
  id uuid primary key default gen_random_uuid(),
  value text not null check (value = btrim(value) and length(value) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index skus_value_ci on public.skus (lower(value));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 1 and 80),
  username text not null check (username = btrim(username) and length(username) between 1 and 80),
  role text not null check (role in ('Owner','Admin','Staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_ci on public.profiles (lower(username));

create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null unique references public.skus(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('Ingredient','Finished')),
  category text not null check (category in ('Food','Beverage','Hobby')),
  unit_code text not null references public.inventory_units(code),
  threshold_base public.stock_quantity not null default 0 check (threshold_base >= 0),
  image_path text,
  unsellable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (kind <> 'Ingredient' or category <> 'Hobby')
);

create table public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id),
  manufactured_on date,
  expires_on date,
  unsellable boolean not null default false,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (expires_on is null or manufactured_on is null or expires_on >= manufactured_on)
);
create index stock_batches_fefo on public.stock_batches (stock_item_id, expires_on, received_at, id)
  where archived_at is null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null unique references public.skus(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  category text not null check (category in ('Food','Beverage','Hobby')),
  stock_model text not null check (stock_model in ('Retail Item','Recipe','Variants','Bundle')),
  stock_item_id uuid references public.stock_items(id),
  base_price public.money_amount not null check (base_price > 0),
  discount_type text not null default 'None' check (discount_type in ('None','Fixed','Percentage')),
  discount_value public.money_amount not null default 0,
  enabled boolean not null default true,
  image_path text,
  icon text,
  manufactured_on date,
  expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check ((stock_model = 'Retail Item') = (stock_item_id is not null)),
  check (category <> 'Hobby' or stock_model <> 'Recipe'),
  check (category = 'Hobby' or (manufactured_on is not null and expires_on is not null)),
  check (expires_on is null or manufactured_on is null or expires_on >= manufactured_on),
  check (case discount_type when 'None' then discount_value = 0
         when 'Fixed' then discount_value <= base_price else discount_value <= 100 end)
);
create index products_stock_link on public.products(stock_item_id);
create index products_catalogue on public.products(category, stock_model) where archived_at is null;

create table public.product_recipe_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  stock_item_id uuid not null references public.stock_items(id),
  quantity public.stock_quantity not null check (quantity > 0),
  unit_code text not null references public.inventory_units(code),
  created_at timestamptz not null default now(),
  unique (product_id, stock_item_id, unit_code)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  stock_item_id uuid not null references public.stock_items(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  price public.money_amount not null check (price > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (product_id, stock_item_id)
);
create unique index product_variants_name_ci on public.product_variants(product_id, lower(btrim(name)));

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  source_group_id uuid references public.modifier_groups(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  min_choices integer not null default 0 check (min_choices >= 0),
  max_choices integer not null default 1 check (max_choices >= min_choices),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (source_group_id is distinct from id)
);
create index modifier_groups_product on public.modifier_groups(product_id);

create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.modifier_groups(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  price public.money_amount not null default 0,
  default_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index modifier_options_group on public.modifier_options(group_id);

create table public.modifier_stock_inputs (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.modifier_options(id),
  stock_item_id uuid not null references public.stock_items(id),
  quantity public.stock_quantity not null check (quantity <> 0),
  unit_code text not null references public.inventory_units(code),
  created_at timestamptz not null default now(),
  unique (option_id, stock_item_id, unit_code)
);

create table public.bundle_components (
  id uuid primary key default gen_random_uuid(),
  bundle_product_id uuid not null references public.products(id),
  component_product_id uuid references public.products(id),
  stock_item_id uuid references public.stock_items(id),
  variant_id uuid references public.product_variants(id),
  quantity integer not null check (quantity > 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  check (num_nonnulls(component_product_id, stock_item_id) = 1),
  check (variant_id is null or component_product_id is not null),
  check (component_product_id is distinct from bundle_product_id)
);
create index bundle_components_parent on public.bundle_components(bundle_product_id);
create index bundle_components_child on public.bundle_components(component_product_id);

create table public.bundle_component_modifiers (
  component_id uuid not null references public.bundle_components(id),
  option_id uuid not null references public.modifier_options(id),
  primary key (component_id, option_id)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (length(btrim(order_number)) > 0),
  idempotency_key uuid not null unique,
  request_hash text not null check (length(btrim(request_hash)) > 0),
  occurred_at timestamptz not null default now(),
  business_date date generated always as ((occurred_at at time zone 'Asia/Manila')::date) stored,
  cashier_id uuid not null references public.profiles(id),
  cashier_name text not null check (length(btrim(cashier_name)) > 0),
  cashier_role text not null check (cashier_role in ('Owner','Admin','Staff')),
  subtotal public.money_amount not null,
  tax_amount public.money_amount not null,
  total public.money_amount not null,
  payment_state text not null default 'Received' check (payment_state = 'Received'),
  fulfilment_state text not null default 'Fulfilled' check (fulfilment_state = 'Fulfilled'),
  review_state text not null check (review_state in ('Awaiting Owner review','Reviewed','Owner checkout')),
  status text not null check (status in ('Pending','Completed','Voided')),
  stock_committed boolean,
  usage_complete boolean,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  voided_name text,
  voided_role text check (voided_role in ('Owner','Admin')),
  void_reason text,
  bulk_action_id uuid,
  created_at timestamptz not null default now(),
  check (total = subtotal + tax_amount),
  check (case when status = 'Voided' then
    voided_at is not null and voided_by is not null and voided_name is not null and length(btrim(voided_name)) > 0
    and voided_role is not null and void_reason is not null and length(btrim(void_reason)) > 0
    else num_nonnulls(voided_at, voided_by, voided_name, voided_role, void_reason, bulk_action_id) = 0 end)
);
create index sales_actor_day on public.sales(cashier_id, business_date, occurred_at);
create index sales_review_queue on public.sales(business_date, review_state) where status <> 'Voided';

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  name text not null check (length(btrim(name)) > 0),
  sku text not null check (length(btrim(sku)) > 0),
  category text not null check (category in ('Food','Beverage','Hobby')),
  quantity integer not null check (quantity > 0),
  unit_price public.money_amount not null,
  original_unit_price public.money_amount not null,
  configuration_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration_snapshot) = 'object'),
  created_at timestamptz not null default now()
);
create index sale_items_sale on public.sale_items(sale_id);

create table public.sale_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items(id),
  option_id uuid references public.modifier_options(id),
  name text not null check (length(btrim(name)) > 0),
  price public.money_amount not null,
  created_at timestamptz not null default now()
);
create index sale_item_modifiers_item on public.sale_item_modifiers(sale_item_id);

create table public.sale_item_stock_usage (
  id uuid primary key default gen_random_uuid(),
  sale_item_id uuid not null references public.sale_items(id),
  stock_item_id uuid not null references public.stock_items(id),
  sku text not null check (length(btrim(sku)) > 0),
  name text not null check (length(btrim(name)) > 0),
  kind text not null check (kind in ('Ingredient','Finished')),
  quantity_base public.stock_quantity not null check (quantity_base >= 0),
  unit_code text not null references public.inventory_units(code),
  created_at timestamptz not null default now()
);
create index sale_item_stock_usage_item on public.sale_item_stock_usage(sale_item_id);
create index sale_item_stock_usage_stock on public.sale_item_stock_usage(stock_item_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references public.sales(id),
  method text not null check (method in ('Cash','GCash')),
  amount public.money_amount not null,
  reference text,
  cash_tendered public.money_amount,
  change_given public.money_amount,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (reference is null or (reference = btrim(reference) and length(reference) > 0)),
  check (case method when 'GCash' then reference is not null and cash_tendered is null and change_given is null
    else reference is null and cash_tendered is not null and change_given is not null
    and cash_tendered >= amount and change_given = cash_tendered - amount end)
);
create unique index payments_reference on public.payments(method, reference) where reference is not null;

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.stock_batches(id),
  stock_sku text not null,
  stock_name text not null,
  unit_code text not null references public.inventory_units(code),
  kind text not null check (kind in ('Opening','Receipt','Consumption','Correction','Removal','Wastage','Return','Transfer')),
  quantity_base public.stock_quantity not null,
  sale_item_id uuid references public.sale_items(id),
  actor_id uuid not null references public.profiles(id),
  actor_name text not null check (length(btrim(actor_name)) > 0),
  actor_role text not null check (actor_role in ('Owner','Admin','Staff')),
  reason text not null check (length(btrim(reason)) > 0),
  occurred_at timestamptz not null default now(),
  business_date date generated always as ((occurred_at at time zone 'Asia/Manila')::date) stored,
  operation_id uuid not null,
  operation_line integer not null default 0 check (operation_line >= 0),
  created_at timestamptz not null default now(),
  unique (operation_id, operation_line),
  check ((kind = 'Consumption') = (sale_item_id is not null)),
  check (case when kind = 'Opening' then quantity_base >= 0
    when kind in ('Receipt','Return') then quantity_base > 0
    when kind in ('Consumption','Removal','Wastage') then quantity_base < 0
    else quantity_base <> 0 end)
);
create unique index stock_movements_opening on public.stock_movements(batch_id) where kind = 'Opening';
create index stock_movements_batch_date on public.stock_movements(batch_id, business_date, occurred_at);
create index stock_movements_sale_item on public.stock_movements(sale_item_id);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('Opening','Addition','Removal','Refund')),
  amount public.money_amount not null check (amount > 0),
  sale_id uuid references public.sales(id),
  actor_id uuid not null references public.profiles(id),
  actor_name text not null check (length(btrim(actor_name)) > 0),
  actor_role text not null check (actor_role in ('Owner','Admin','Staff')),
  reason text not null check (length(btrim(reason)) > 0),
  occurred_at timestamptz not null default now(),
  business_date date generated always as ((occurred_at at time zone 'Asia/Manila')::date) stored,
  operation_id uuid not null unique,
  created_at timestamptz not null default now()
);
create index cash_movements_date on public.cash_movements(business_date, occurred_at);

create table public.void_requests (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  reason text not null check (length(btrim(reason)) > 0),
  requested_by uuid not null references public.profiles(id),
  requested_name text not null check (length(btrim(requested_name)) > 0),
  requested_role text not null check (requested_role in ('Owner','Admin','Staff')),
  requested_at timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_name text,
  reviewed_role text check (reviewed_role in ('Owner','Admin')),
  reviewed_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  check (case when status = 'Pending' then
    num_nonnulls(reviewed_by, reviewed_name, reviewed_role, reviewed_at, decision_reason) = 0
    else reviewed_by is not null and reviewed_role is not null and reviewed_at is not null
      and reviewed_name is not null and length(btrim(reviewed_name)) > 0
      and decision_reason is not null and length(btrim(decision_reason)) > 0 end)
);
create unique index void_requests_pending on public.void_requests(sale_id) where status = 'Pending';
create index void_requests_sale on public.void_requests(sale_id, requested_at);

create table public.daily_sales_reviews (
  id uuid primary key default gen_random_uuid(),
  business_date date not null,
  owner_id uuid not null references public.profiles(id),
  owner_name text not null check (length(btrim(owner_name)) > 0),
  owner_role text not null default 'Owner' check (owner_role = 'Owner'),
  reviewed_at timestamptz not null default now(),
  expected_cash public.money_amount not null,
  expected_gcash public.money_amount not null,
  verified_cash public.money_amount not null,
  verified_gcash public.money_amount not null,
  counted_cash public.money_amount not null,
  opening_cash public.money_amount not null,
  additions public.money_amount not null,
  removals public.money_amount not null,
  refunds public.money_amount not null,
  explanation text not null default '',
  outcome text not null check (outcome in ('Matched','Reviewed with explained discrepancy')),
  operation_id uuid not null unique,
  created_at timestamptz not null default now(),
  check ((expected_cash = verified_cash and expected_gcash = verified_gcash) or length(btrim(explanation)) > 0),
  check (outcome <> 'Matched' or (expected_cash = verified_cash and expected_gcash = verified_gcash))
);
create index daily_sales_reviews_date on public.daily_sales_reviews(business_date);

create table public.daily_sales_review_items (
  review_id uuid not null references public.daily_sales_reviews(id),
  sale_id uuid not null unique references public.sales(id),
  receipt_verified boolean not null,
  verified_amount public.money_amount not null,
  primary key (review_id, sale_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  actor_name text not null check (length(btrim(actor_name)) > 0),
  actor_role text not null check (actor_role in ('Owner','Admin','Staff')),
  event_type text not null check (length(btrim(event_type)) > 0),
  entity_type text not null check (length(btrim(entity_type)) > 0),
  entity_id uuid not null,
  reason text not null check (length(btrim(reason)) > 0),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now(),
  operation_id uuid not null,
  created_at timestamptz not null default now()
);
create index audit_events_entity on public.audit_events(entity_type, entity_id, occurred_at);
create index audit_events_actor on public.audit_events(actor_id, occurred_at);
create index audit_events_operation on public.audit_events(operation_id);

create table public.alert_settings (
  singleton boolean primary key default true check (singleton),
  similar_order_threshold integer not null default 5 check (similar_order_threshold between 2 and 100),
  window_minutes integer not null default 2 check (window_minutes between 1 and 60),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- Do not depend on environment-specific Supabase default grants.
do $$
declare t text;
begin
  foreach t in array array['inventory_units','skus','profiles','stock_items','stock_batches',
    'products','product_recipe_items','product_variants','modifier_groups','modifier_options',
    'modifier_stock_inputs','bundle_components','bundle_component_modifiers','sales','sale_items',
    'sale_item_modifiers','sale_item_stock_usage','payments','stock_movements','cash_movements',
    'void_requests','daily_sales_reviews','daily_sales_review_items','audit_events','alert_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
  end loop;
end $$;

commit;
