-- Retail sub-packaging for drum/bucket products: a shop buys a drum (e.g. a
-- 208L oil drum) and sells it back out in small portions (250ml, 500ml, 1L...)
-- each at its own preset price, all drawn from the same opened drum's stock.
--
-- Stock model: qty_on_hand keeps counting whole SEALED drums, as it already
-- does. A new open_qty_remaining tracks how much (in the drum's measurement
-- unit) is left in the drum currently being poured from. When a retail sale
-- needs more than what's left open, the next sealed drum is opened
-- automatically (qty_on_hand -1, open_qty_remaining += pack_size).

alter table parts add column open_qty_remaining numeric(12,3) not null default 0;

create table drum_retail_prices (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references parts(id) on delete cascade,
  label text not null,
  quantity numeric(12,4) not null check (quantity > 0),
  sell_price numeric(12,2) not null check (sell_price >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table drum_retail_prices enable row level security;
create policy "drum_retail_prices_select" on drum_retail_prices for select using (auth.uid() is not null);
create policy "drum_retail_prices_write_admin" on drum_retail_prices for all using (is_admin(auth.uid()));

-- Cashier-safe view, extended with the drum fields the POS retail-tier picker needs.
create or replace view parts_cashier as
  select id, sku, barcode, name, description, category_id, sell_price, retail_price,
         tax_id, is_tax_inclusive_price, is_price_change_allowed, is_using_default_quantity,
         is_service, qty_on_hand, low_stock_threshold, low_stock_warning_enabled, unit, is_active,
         round(cost_price * 1.03, 2) as min_price,
         is_drum, pack_size, drum_measurement, open_qty_remaining
  from parts;

-- Which sale_items row drew from a drum, and how much (in the drum's unit) it
-- drew — independent of qty/unit_price, which stay in "retail units sold" so
-- receipts read naturally (e.g. "2 x 250ml").
alter table sale_items add column drum_draw_qty numeric(12,4);

create or replace function apply_sale_item() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_is_service boolean;
  v_is_drum boolean;
  v_pack_size numeric;
  v_open numeric;
  v_sealed numeric;
  v_need numeric;
  v_take numeric;
begin
  select is_service, is_drum, nullif(pack_size, '')::numeric, open_qty_remaining, qty_on_hand
    into v_is_service, v_is_drum, v_pack_size, v_open, v_sealed
    from parts where id = new.part_id;

  if new.drum_draw_qty is not null and coalesce(v_is_drum, false) then
    v_need := new.drum_draw_qty;

    v_take := least(v_open, v_need);
    v_open := v_open - v_take;
    v_need := v_need - v_take;

    while v_need > 0 loop
      if v_sealed < 1 or v_pack_size is null or v_pack_size <= 0 then
        raise exception 'Not enough drum stock to complete this sale.';
      end if;
      v_sealed := v_sealed - 1;
      v_open := v_open + v_pack_size;
      v_take := least(v_open, v_need);
      v_open := v_open - v_take;
      v_need := v_need - v_take;
    end loop;

    update parts set qty_on_hand = v_sealed, open_qty_remaining = v_open, updated_at = now()
      where id = new.part_id;
    insert into stock_movements (part_id, change_qty, reason, ref_id, created_by)
    values (new.part_id, -new.drum_draw_qty, 'sale', new.sale_id, (select cashier_id from sales where id = new.sale_id));
  elsif not coalesce(v_is_service, false) then
    update parts set qty_on_hand = qty_on_hand - new.qty, updated_at = now() where id = new.part_id;
    insert into stock_movements (part_id, change_qty, reason, ref_id, created_by)
    values (new.part_id, -new.qty, 'sale', new.sale_id, (select cashier_id from sales where id = new.sale_id));
  end if;
  return new;
end;
$$;

-- Floor check: for a drum retail line, compare against the proportional
-- cost (per-drum cost scaled to the portion sold), not the per-drum cost
-- itself, since unit_price here is the tier's flat price (qty is "how many
-- of this retail size", not litres).
create or replace function check_sale_item_floor() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  part_cost numeric(12,2);
  part_sell_price numeric(12,2);
  pack_size_num numeric;
  min_price numeric(12,2);
  max_discount numeric(12,2);
begin
  if new.package_group is not null then
    return new;
  end if;

  if new.drum_draw_qty is not null then
    select cost_price, nullif(pack_size, '')::numeric into part_cost, pack_size_num
      from parts where id = new.part_id;
    if pack_size_num is null or pack_size_num <= 0 then
      return new;
    end if;
    min_price := round((part_cost / pack_size_num) * new.drum_draw_qty * 1.03, 2);
    if new.unit_price < min_price - 0.01 then
      raise exception 'Minimum allowed price is %', min_price
        using detail = jsonb_build_object('part_id', new.part_id, 'min_price', min_price)::text;
    end if;
    return new;
  end if;

  select cost_price, sell_price into part_cost, part_sell_price from parts where id = new.part_id;
  min_price := round(part_cost * 1.03, 2);
  if new.unit_price < min_price - 0.01 then
    max_discount := greatest(round(part_sell_price - min_price, 2), 0);
    raise exception 'Minimum allowed price is %', min_price
      using detail = jsonb_build_object('part_id', new.part_id, 'min_price', min_price, 'max_discount', max_discount)::text;
  end if;
  return new;
end;
$$;
