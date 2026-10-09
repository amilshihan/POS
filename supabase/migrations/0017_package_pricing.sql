-- Package pricing: let a cashier sell two or more items together at one
-- combined price, as long as the combined total still clears the combined
-- cost + 3% profit floor (even if an individual item in the package is
-- priced below its own floor). The per-item floor trigger skips rows that
-- belong to a package; create_package_sale_items() validates and inserts
-- the whole package as one unit instead.

alter table sale_items add column package_group uuid;

create or replace function check_sale_item_floor() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  part_cost numeric(12,2);
  part_sell_price numeric(12,2);
  min_price numeric(12,2);
  max_discount numeric(12,2);
begin
  if new.package_group is not null then
    return new;
  end if;

  select cost_price, sell_price into part_cost, part_sell_price from parts where id = new.part_id;
  min_price := round(part_cost * 1.03, 2);
  if new.unit_price < min_price - 0.01 then
    max_discount := greatest(round(part_sell_price - min_price, 2), 0);
    raise exception 'Price % is below the minimum allowed price of % (cost + 3%% profit) for this item. The maximum discount that can be given is %.', new.unit_price, min_price, max_discount;
  end if;
  return new;
end;
$$;

create function create_package_sale_items(p_sale_id uuid, p_items jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  total_charge numeric(12,2) := 0;
  total_floor numeric(12,2) := 0;
  item jsonb;
  v_part_id uuid;
  v_qty numeric(12,2);
  v_unit_price numeric(12,2);
  v_cost numeric(12,2);
  pkg_tag uuid := gen_random_uuid();
begin
  if jsonb_array_length(p_items) < 2 then
    raise exception 'A package needs at least two items.';
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
  end loop;

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
