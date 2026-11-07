-- Configurable payment types (Cash, Credit Card, Online Transfer, etc.)
-- each with its own processing commission %, managed from Settings ->
-- Payments. Sales and customer payments snapshot the commission rate at
-- the time of the transaction, so later rate changes don't rewrite history.

create table payment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('cash', 'card', 'online')),
  commission_percent numeric(5,2) not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table payment_types enable row level security;
create policy "payment_types_select" on payment_types for select using (auth.uid() is not null);
create policy "payment_types_write_admin" on payment_types for insert with check (is_admin(auth.uid()));
create policy "payment_types_update_admin" on payment_types for update using (is_admin(auth.uid()));
create policy "payment_types_delete_admin" on payment_types for delete using (is_admin(auth.uid()));

insert into payment_types (name, kind, commission_percent, sort_order) values
  ('Cash', 'cash', 0, 0),
  ('Credit Card', 'card', 0, 1),
  ('Online Transfer', 'online', 0, 2);

alter table sales
  add column payment_type_id uuid references payment_types(id),
  add column commission_percent_snapshot numeric(5,2);

alter table payments
  add column payment_type_id uuid references payment_types(id),
  add column commission_percent_snapshot numeric(5,2);

create or replace function set_sale_commission_snapshot() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.payment_type_id is not null then
    select commission_percent into new.commission_percent_snapshot
      from payment_types where id = new.payment_type_id;
  end if;
  return new;
end;
$$;

create trigger trg_set_sale_commission_snapshot
  before insert on sales
  for each row execute function set_sale_commission_snapshot();

create or replace function set_payment_commission_snapshot() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.payment_type_id is not null then
    select commission_percent into new.commission_percent_snapshot
      from payment_types where id = new.payment_type_id;
  end if;
  return new;
end;
$$;

create trigger trg_set_payment_commission_snapshot
  before insert on payments
  for each row execute function set_payment_commission_snapshot();
