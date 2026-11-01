-- Held/parked sales: let a cashier save the current cart as a draft and
-- start a fresh New Sale, then come back and resume the draft later.
-- Shared across the shop (any staff can see/resume any draft), not tied
-- to one browser, so a draft survives a page refresh or a different
-- cashier picking it up.

create table sale_drafts (
  id uuid primary key default gen_random_uuid(),
  label text,
  cart jsonb not null,
  customer_id uuid references customers(id),
  new_customer_title text,
  new_customer_name text,
  new_customer_phone_country text,
  new_customer_phone text,
  discount numeric(12,2) not null default 0,
  payment_method payment_method not null default 'cash',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table sale_drafts enable row level security;
create policy "sale_drafts_all" on sale_drafts for all using (auth.uid() is not null);
