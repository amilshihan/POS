-- Cancel/refund a completed sale: restores the stock it took out (including
-- drum/bucket retail draws and package lines), reverses any credit balance
-- it added, and marks the sale voided. Used for "customer paid, came back
-- with the item, we refund them" returns.

alter table sales
  add column voided_at timestamptz,
  add column void_reason text,
  add column voided_by uuid references profiles(id);

create or replace function void_sale(p_sale_id uuid, p_reason text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_sale sales%rowtype;
  item record;
  v_pack_size numeric;
  v_open numeric;
  v_sealed numeric;
  v_restore numeric;
  v_room numeric;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Only an admin can cancel a sale.';
  end if;

  select * into v_sale from sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Sale not found.';
  end if;
  if v_sale.status = 'voided' then
    raise exception 'This sale is already cancelled.';
  end if;

  for item in select * from sale_items where sale_id = p_sale_id loop
    if item.drum_draw_qty is not null then
      select nullif(pack_size, '')::numeric, open_qty_remaining, qty_on_hand
        into v_pack_size, v_open, v_sealed
        from parts where id = item.part_id;

      v_restore := item.drum_draw_qty;
      if v_pack_size is not null and v_pack_size > 0 then
        v_room := v_pack_size - v_open;
        if v_restore <= v_room then
          v_open := v_open + v_restore;
        else
          v_open := v_open + v_restore;
          v_sealed := v_sealed + floor(v_open / v_pack_size);
          v_open := v_open - floor(v_open / v_pack_size) * v_pack_size;
        end if;
        update parts set qty_on_hand = v_sealed, open_qty_remaining = v_open, updated_at = now()
          where id = item.part_id;
      end if;
    else
      update parts set qty_on_hand = qty_on_hand + item.qty, updated_at = now()
        where id = item.part_id and not coalesce(is_service, false);
    end if;

    insert into stock_movements (part_id, change_qty, reason, ref_id, created_by)
      values (item.part_id, coalesce(item.drum_draw_qty, item.qty), 'adjustment', p_sale_id, auth.uid());
  end loop;

  if v_sale.customer_id is not null and v_sale.payment_method in ('credit', 'mixed') then
    update customers
      set credit_balance = credit_balance - (v_sale.total - v_sale.amount_paid)
      where id = v_sale.customer_id;
  end if;

  update sales
    set status = 'voided', voided_at = now(), void_reason = p_reason, voided_by = auth.uid()
    where id = p_sale_id;
end;
$$;
