-- Bug: sale_items.cost_price_snapshot was always set to the part's raw
-- cost_price, even for a drum/bucket retail draw (drum_draw_qty set),
-- where that cost_price is the cost of the WHOLE sealed drum, not the
-- small portion actually sold. This made every drum-draw sale look like
-- a huge loss in profit reports. check_sale_item_floor() already computes
-- the proportional cost correctly for the floor check — apply the same
-- math here.
create or replace function set_sale_item_cost_snapshot() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  part_cost numeric(12,2);
  pack_size_num numeric;
begin
  select cost_price, nullif(pack_size, '')::numeric into part_cost, pack_size_num
    from parts where id = new.part_id;

  if new.drum_draw_qty is not null and pack_size_num is not null and pack_size_num > 0 then
    new.cost_price_snapshot := round((part_cost / pack_size_num) * new.drum_draw_qty, 2);
  else
    new.cost_price_snapshot := part_cost;
  end if;
  return new;
end;
$$;

-- Backfill: correct every past drum-draw sale_items row the same way,
-- using each product's current cost_price/pack_size (the best estimate
-- available, since historical cost isn't separately tracked).
update sale_items si
  set cost_price_snapshot = round((p.cost_price / nullif(p.pack_size, '')::numeric) * si.drum_draw_qty, 2)
  from parts p
  where si.part_id = p.id
    and si.drum_draw_qty is not null
    and nullif(p.pack_size, '')::numeric > 0;
