-- Enforce a minimum profit floor (cost + 3%) on sale item pricing. Runs as
-- security definer so the floor check can read parts.cost_price without the
-- POS client ever needing to query cost_price itself.
create function check_sale_item_floor() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  part_cost numeric(12,2);
  min_price numeric(12,2);
begin
  select cost_price into part_cost from parts where id = new.part_id;
  min_price := round(part_cost * 1.03, 2);
  if new.unit_price < min_price - 0.01 then
    raise exception 'Price % is below the minimum allowed price of % (cost + 3%% profit) for this item.', new.unit_price, min_price;
  end if;
  return new;
end;
$$;

create trigger trg_check_sale_item_floor
  before insert or update of unit_price on sale_items
  for each row execute function check_sale_item_floor();
