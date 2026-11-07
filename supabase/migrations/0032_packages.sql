-- Reusable sale packages: an admin predefines a bundle of one or more
-- products (each with a quantity) sold together at one fixed price.
-- Selling a package reuses the existing ad-hoc package-sale machinery
-- (create_package_sale_items -> sale_items tagged with package_group),
-- so stock is reduced per component the same way a normal sale item is.

create table packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  part_id uuid not null references parts(id),
  qty numeric(12,2) not null check (qty > 0)
);

alter table packages enable row level security;
alter table package_items enable row level security;

create policy "packages_select" on packages for select using (auth.uid() is not null);
create policy "packages_write_admin" on packages for insert with check (is_admin(auth.uid()));
create policy "packages_update_admin" on packages for update using (is_admin(auth.uid()));
create policy "packages_delete_admin" on packages for delete using (is_admin(auth.uid()));

create policy "package_items_select" on package_items for select using (auth.uid() is not null);
create policy "package_items_write_admin" on package_items for insert with check (is_admin(auth.uid()));
create policy "package_items_update_admin" on package_items for update using (is_admin(auth.uid()));
create policy "package_items_delete_admin" on package_items for delete using (is_admin(auth.uid()));

-- A saved package may bundle just one product at a higher quantity (e.g.
-- "2 cans of Motul 10W-30 3L for 15,000"), not only two different products,
-- so relax the old "at least two items" rule to "at least two units total".
create or replace function create_package_sale_items(p_sale_id uuid, p_items jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  total_charge numeric(12,2) := 0;
  total_floor numeric(12,2) := 0;
  total_qty numeric(12,2) := 0;
  item jsonb;
  v_part_id uuid;
  v_qty numeric(12,2);
  v_unit_price numeric(12,2);
  v_cost numeric(12,2);
  pkg_tag uuid := gen_random_uuid();
begin
  if jsonb_array_length(p_items) < 1 then
    raise exception 'A package needs at least one item.';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_part_id := (item->>'part_id')::uuid;
    v_qty := (item->>'qty')::numeric;
    v_unit_price := (item->>'unit_price')::numeric;
    select cost_price into v_cost from parts where id = v_part_id;
    if v_cost is null then
      raise exception 'Unknown product in package.';
    end if;
    total_charge := total_charge + (v_unit_price * v_qty);
    total_floor := total_floor + (round(v_cost * 1.03, 2) * v_qty);
    total_qty := total_qty + v_qty;
  end loop;

  if total_qty < 2 then
    raise exception 'A package needs at least two units total.';
  end if;

  if total_charge < total_floor - 0.01 then
    raise exception 'Package price % is below the minimum allowed combined price of % (combined cost + 3%% profit).', total_charge, total_floor;
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_part_id := (item->>'part_id')::uuid;
    v_qty := (item->>'qty')::numeric;
    v_unit_price := (item->>'unit_price')::numeric;
    insert into sale_items (sale_id, part_id, qty, unit_price, line_total, package_group)
      values (p_sale_id, v_part_id, v_qty, v_unit_price, round(v_qty * v_unit_price, 2), pkg_tag);
  end loop;
end;
$$;
