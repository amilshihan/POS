-- Fix: the drum-tier floor check compared unit_price (price per retail
-- unit, e.g. per 250ml) against a floor computed from the FULL line's
-- drawn quantity (drum_draw_qty, e.g. 225L for 900 units) instead of the
-- per-unit drawn amount (drum_draw_qty / qty, e.g. 0.25L) — so any tier
-- line with qty > 1 was rejected even at a perfectly legitimate price.

create or replace function check_sale_item_floor() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  part_cost numeric(12,2);
  part_sell_price numeric(12,2);
  pack_size_num numeric;
  per_unit_draw numeric;
  min_price numeric(12,2);
  max_discount numeric(12,2);
begin
  if new.package_group is not null then
    return new;
  end if;

  if new.drum_draw_qty is not null then
    select cost_price, nullif(pack_size, '')::numeric into part_cost, pack_size_num
      from parts where id = new.part_id;
    if pack_size_num is null or pack_size_num <= 0 or new.qty is null or new.qty = 0 then
      return new;
    end if;
    per_unit_draw := new.drum_draw_qty / new.qty;
    min_price := round((part_cost / pack_size_num) * per_unit_draw * 1.03, 2);
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
