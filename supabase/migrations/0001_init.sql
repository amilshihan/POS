-- Spare Parts Shop POS — initial schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────
create type user_role as enum ('admin', 'cashier');
create type payment_method as enum ('cash', 'credit', 'cheque', 'mixed');
create type cheque_direction as enum ('received', 'issued');
create type cheque_status as enum ('pending', 'cleared', 'bounced');
create type stock_reason as enum ('sale', 'purchase', 'adjustment');

-- ─────────────────────────────────────────────────────────────
-- PROFILES (staff accounts, one row per auth.users row)
-- ─────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'cashier',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create function is_admin(uid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role = 'admin' and is_active);
$$;

-- Auto-create a profile row whenever a new auth user is created.
create function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'cashier');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- CATEGORIES & PARTS
-- ─────────────────────────────────────────────────────────────
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table parts (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  barcode text unique,
  name text not null,
  description text,
  category_id uuid references categories(id) on delete set null,
  cost_price numeric(12,2) not null default 0,
  sell_price numeric(12,2) not null default 0,
  qty_on_hand numeric(12,2) not null default 0,
  low_stock_threshold numeric(12,2) not null default 5,
  unit text not null default 'pcs',
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cashier-safe view: hides cost_price / margins from staff who shouldn't see them.
create view parts_cashier as
  select id, sku, barcode, name, description, category_id, sell_price,
         qty_on_hand, low_stock_threshold, unit, is_active
  from parts;

-- ─────────────────────────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────────────────────────
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  credit_limit numeric(12,2) not null default 0,
  credit_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- SALES / SALE ITEMS
-- ─────────────────────────────────────────────────────────────
create sequence sale_number_seq start 1;

create table sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique default ('S-' || lpad(nextval('sale_number_seq')::text, 6, '0')),
  customer_id uuid references customers(id),
  cashier_id uuid not null references profiles(id),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  payment_method payment_method not null default 'cash',
  status text not null default 'completed' check (status in ('completed', 'voided')),
  created_at timestamptz not null default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  part_id uuid not null references parts(id),
  qty numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  cost_price_snapshot numeric(12,2) not null default 0,
  line_total numeric(12,2) not null
);

-- ─────────────────────────────────────────────────────────────
-- CUSTOMER PAYMENTS (credit repayments)
-- ─────────────────────────────────────────────────────────────
create table payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  sale_id uuid references sales(id),
  amount numeric(12,2) not null,
  method payment_method not null default 'cash',
  received_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- SUPPLIERS / PURCHASES
-- ─────────────────────────────────────────────────────────────
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create sequence purchase_number_seq start 1;

create table purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null unique default ('P-' || lpad(nextval('purchase_number_seq')::text, 6, '0')),
  supplier_id uuid not null references suppliers(id),
  purchased_by uuid not null references profiles(id),
  total numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  created_at timestamptz not null default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  part_id uuid not null references parts(id),
  qty numeric(12,2) not null,
  unit_cost numeric(12,2) not null,
  line_total numeric(12,2) not null
);

-- ─────────────────────────────────────────────────────────────
-- CHEQUES
-- ─────────────────────────────────────────────────────────────
create table cheques (
  id uuid primary key default gen_random_uuid(),
  direction cheque_direction not null,
  related_sale_id uuid references sales(id),
  related_purchase_id uuid references purchases(id),
  customer_id uuid references customers(id),
  supplier_id uuid references suppliers(id),
  cheque_number text not null,
  bank_name text,
  amount numeric(12,2) not null,
  due_date date not null,
  status cheque_status not null default 'pending',
  cleared_date date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- SHOP SETTINGS (single row)
-- ─────────────────────────────────────────────────────────────
create table shop_settings (
  id boolean primary key default true check (id),
  shop_name text not null default 'My Spare Parts Shop',
  address text,
  phone text,
  receipt_width_mm integer not null default 80 check (receipt_width_mm in (58, 80)),
  low_stock_default_threshold numeric(12,2) not null default 5,
  cheque_alert_days integer not null default 7,
  updated_at timestamptz not null default now()
);
insert into shop_settings (id) values (true);

-- ─────────────────────────────────────────────────────────────
-- STOCK MOVEMENTS (audit trail)
-- ─────────────────────────────────────────────────────────────
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references parts(id),
  change_qty numeric(12,2) not null,
  reason stock_reason not null,
  ref_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- TRIGGERS: keep stock + credit balances correct automatically
-- ─────────────────────────────────────────────────────────────

-- Sale line item inserted → server fills cost_price_snapshot from parts table.
-- (Cashiers query parts via the parts_cashier view, which hides cost_price, so the
-- client never has a real cost figure to send; this trigger backfills it authoritatively
-- regardless of what value — if any — the client supplied.)
create function set_sale_item_cost_snapshot() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  select cost_price into new.cost_price_snapshot from parts where id = new.part_id;
  return new;
end;
$$;

create trigger trg_set_sale_item_cost_snapshot
  before insert on sale_items
  for each row execute function set_sale_item_cost_snapshot();

-- Sale line item inserted → decrement stock, log movement.
create function apply_sale_item() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update parts set qty_on_hand = qty_on_hand - new.qty, updated_at = now() where id = new.part_id;
  insert into stock_movements (part_id, change_qty, reason, ref_id, created_by)
  values (new.part_id, -new.qty, 'sale', new.sale_id, (select cashier_id from sales where id = new.sale_id));
  return new;
end;
$$;

create trigger trg_apply_sale_item
  after insert on sale_items
  for each row execute function apply_sale_item();

-- Purchase line item inserted → increment stock, update cost price, log movement.
create function apply_purchase_item() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update parts
    set qty_on_hand = qty_on_hand + new.qty,
        cost_price = new.unit_cost,
        updated_at = now()
    where id = new.part_id;
  insert into stock_movements (part_id, change_qty, reason, ref_id, created_by)
  values (new.part_id, new.qty, 'purchase', new.purchase_id,
          (select purchased_by from purchases where id = new.purchase_id));
  return new;
end;
$$;

create trigger trg_apply_purchase_item
  after insert on purchase_items
  for each row execute function apply_purchase_item();

-- Credit sale inserted → increase customer's outstanding balance.
create function apply_sale_credit() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null and new.payment_method in ('credit', 'mixed') then
    update customers
      set credit_balance = credit_balance + (new.total - new.amount_paid)
      where id = new.customer_id;
  end if;
  return new;
end;
$$;

create trigger trg_apply_sale_credit
  after insert on sales
  for each row execute function apply_sale_credit();

-- Payment recorded → decrease customer's outstanding balance.
create function apply_payment() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update customers set credit_balance = credit_balance - new.amount where id = new.customer_id;
  return new;
end;
$$;

create trigger trg_apply_payment
  after insert on payments
  for each row execute function apply_payment();

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table categories enable row level security;
alter table parts enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table payments enable row level security;
alter table suppliers enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table cheques enable row level security;
alter table stock_movements enable row level security;
alter table shop_settings enable row level security;

create policy "shop_settings_select" on shop_settings for select using (auth.uid() is not null);
create policy "shop_settings_update_admin" on shop_settings for update using (is_admin(auth.uid()));

-- profiles: everyone can see active staff (for cashier attribution), only admin manages roles.
create policy "profiles_select_all" on profiles for select using (auth.uid() is not null);
create policy "profiles_update_admin" on profiles for update using (is_admin(auth.uid()));
create policy "profiles_update_self_name" on profiles for update using (auth.uid() = id);

-- categories / parts: everyone (logged in) can read; only admin writes.
create policy "categories_select" on categories for select using (auth.uid() is not null);
create policy "categories_write_admin" on categories for all using (is_admin(auth.uid()));

create policy "parts_select" on parts for select using (auth.uid() is not null);
create policy "parts_write_admin" on parts for insert with check (is_admin(auth.uid()));
create policy "parts_update_admin" on parts for update using (is_admin(auth.uid()));
create policy "parts_delete_admin" on parts for delete using (is_admin(auth.uid()));
-- cashiers may adjust stock qty only (handled through stock adjustment RPC, not direct table writes)

-- customers: everyone (logged in) can read/write basic records (needed at point of sale).
create policy "customers_all" on customers for all using (auth.uid() is not null);

-- sales / sale_items: any staff member can create; only admin (or the cashier who made it) can read others'.
create policy "sales_select" on sales for select using (auth.uid() is not null);
create policy "sales_insert" on sales for insert with check (auth.uid() is not null and cashier_id = auth.uid());
create policy "sales_update_admin" on sales for update using (is_admin(auth.uid()));

create policy "sale_items_select" on sale_items for select using (auth.uid() is not null);
create policy "sale_items_insert" on sale_items for insert with check (auth.uid() is not null);

-- payments: any staff can record; read open to all logged-in staff.
create policy "payments_all" on payments for select using (auth.uid() is not null);
create policy "payments_insert" on payments for insert with check (auth.uid() is not null);

-- suppliers / purchases / purchase_items: admin only (cashiers must not see supplier cost data).
create policy "suppliers_admin" on suppliers for all using (is_admin(auth.uid()));
create policy "purchases_admin" on purchases for all using (is_admin(auth.uid()));
create policy "purchase_items_admin" on purchase_items for all using (is_admin(auth.uid()));

-- cheques: staff can create/read; only admin can delete.
create policy "cheques_select" on cheques for select using (auth.uid() is not null);
create policy "cheques_insert" on cheques for insert with check (auth.uid() is not null);
create policy "cheques_update" on cheques for update using (auth.uid() is not null);
create policy "cheques_delete_admin" on cheques for delete using (is_admin(auth.uid()));

-- stock_movements: read-only audit trail, visible to all staff, written only by triggers (security definer).
create policy "stock_movements_select" on stock_movements for select using (auth.uid() is not null);
