-- Extended product attributes to match a full POS product record.
--
-- Field mapping to the existing `parts` table (unchanged columns, for reference):
--   Name -> name, ProductGroup -> category_id, SKU -> sku, Barcode -> barcode,
--   MeasurementUnit -> unit, Cost -> cost_price, Price -> sell_price,
--   IsEnabled -> is_active, Description -> description, Quantity -> qty_on_hand,
--   LowStockWarning/WarningQuantity -> low_stock_warning_enabled/low_stock_threshold.

create table taxes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rate_percent numeric(6,3) not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table parts
  add column retail_price numeric(12,2) not null default 0,
  add column markup_percent numeric(7,3),
  add column tax_id uuid references taxes(id),
  add column is_tax_inclusive_price boolean not null default false,
  add column is_price_change_allowed boolean not null default true,
  add column is_using_default_quantity boolean not null default true,
  add column is_service boolean not null default false,
  add column supplier_id uuid references suppliers(id),
  add column reorder_point numeric(12,2),
  add column preferred_quantity numeric(12,2),
  add column low_stock_warning_enabled boolean not null default true;

alter table taxes enable row level security;
create policy "taxes_select" on taxes for select using (auth.uid() is not null);
create policy "taxes_write_admin" on taxes for all using (is_admin(auth.uid()));

-- Cashier-safe view: refresh to include the new POS-relevant fields, still
-- hiding cost/margin/procurement data (cost_price, markup_percent, supplier_id,
-- reorder_point, preferred_quantity).
drop view if exists parts_cashier;
create view parts_cashier as
  select id, sku, barcode, name, description, category_id, sell_price, retail_price,
         tax_id, is_tax_inclusive_price, is_price_change_allowed, is_using_default_quantity,
         is_service, qty_on_hand, low_stock_threshold, low_stock_warning_enabled, unit, is_active
  from parts;

-- Services aren't stock-tracked: skip stock movement/decrement for service parts.
create or replace function apply_sale_item() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_is_service boolean;
begin
  select is_service into v_is_service from parts where id = new.part_id;
  if not coalesce(v_is_service, false) then
    update parts set qty_on_hand = qty_on_hand - new.qty, updated_at = now() where id = new.part_id;
    insert into stock_movements (part_id, change_qty, reason, ref_id, created_by)
    values (new.part_id, -new.qty, 'sale', new.sale_id, (select cashier_id from sales where id = new.sale_id));
  end if;
  return new;
end;
$$;

-- Services still get their cost_price refreshed from a purchase, just no stock movement.
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
          updated_at = now()
      where id = new.part_id;
    insert into stock_movements (part_id, change_qty, reason, ref_id, created_by)
    values (new.part_id, new.qty, 'purchase', new.purchase_id,
            (select purchased_by from purchases where id = new.purchase_id));
  else
    update parts set cost_price = new.unit_cost, updated_at = now() where id = new.part_id;
  end if;
  return new;
end;
$$;
