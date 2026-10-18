-- Shorten the floor-violation message now that it's shown inline next to
-- the specific cart line (the attempted price is already visible in the
-- input itself, so the message doesn't need to repeat it).

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
    raise exception 'Minimum allowed price is %', min_price
      using detail = jsonb_build_object('part_id', new.part_id, 'min_price', min_price, 'max_discount', max_discount)::text;
  end if;
  return new;
end;
$$;
