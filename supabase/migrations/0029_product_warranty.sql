-- Optional warranty terms on a product (e.g. "6 months"), shown on the
-- printed bill for items that have one.

alter table parts
  add column has_warranty boolean not null default false,
  add column warranty_months integer;

create or replace view parts_cashier as
  select id, sku, barcode, name, description, category_id, sell_price, retail_price,
         tax_id, is_tax_inclusive_price, is_price_change_allowed, is_using_default_quantity,
         is_service, qty_on_hand, low_stock_threshold, low_stock_warning_enabled, unit, is_active,
         round(cost_price * 1.03, 2) as min_price,
         is_drum, pack_size, drum_measurement, open_qty_remaining,
         has_warranty, warranty_months
  from parts;
