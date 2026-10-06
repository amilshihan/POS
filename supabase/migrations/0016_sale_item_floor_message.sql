-- Include the maximum allowed discount in the floor-violation error message.
create or replace function check_sale_item_floor() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  part_cost numeric(12,2);
  part_sell_price numeric(12,2);
  min_price numeric(12,2);
  max_discount numeric(12,2);
begin
  select cost_price, sell_price into part_cost, part_sell_price from parts where id = new.part_id;
  min_price := round(part_cost * 1.03, 2);
  if new.unit_price < min_price - 0.01 then
    max_discount := greatest(round(part_sell_price - min_price, 2), 0);
    raise exception 'Price % is below the minimum allowed price of % (cost + 3%% profit) for this item. The maximum discount that can be given is %.', new.unit_price, min_price, max_discount;
  end if;
  return new;
end;
$$;
