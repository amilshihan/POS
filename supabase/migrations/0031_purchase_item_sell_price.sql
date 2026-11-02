-- Let a purchase line set the POS sell price for the product directly,
-- defaulting to cost + 10% margin on the client, editable per line.

alter table purchase_items
  add column sell_price numeric(12,2);

create or replace function apply_purchase_item() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_is_service boolean;
begin
  select is_service into v_is_service from parts where id = new.part_id;
  if not coalesce(v_is_service, false) then
    update parts
      set qty_on_hand = qty_on_hand + new.qty,
          cost_price = new.unit_cost,
          sell_price = coalesce(new.sell_price, sell_price),
          retail_price = coalesce(new.retail_price, retail_price),
          updated_at = now()
      where id = new.part_id;
    insert into stock_movements (part_id, change_qty, reason, ref_id, created_by)
    values (new.part_id, new.qty, 'purchase', new.purchase_id,
            (select purchased_by from purchases where id = new.purchase_id));
  else
    update parts
      set cost_price = new.unit_cost,
          sell_price = coalesce(new.sell_price, sell_price),
          retail_price = coalesce(new.retail_price, retail_price),
          updated_at = now()
      where id = new.part_id;
  end if;
  return new;
end;
$$;
