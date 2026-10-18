-- Expose the cost+3% floor (not the raw cost) to cashiers so the POS screen
-- can validate a typed price the moment it's entered, instead of waiting
-- for checkout to find out from the server.

create or replace view parts_cashier as
  select id, sku, barcode, name, description, category_id, sell_price, retail_price,
         tax_id, is_tax_inclusive_price, is_price_change_allowed, is_using_default_quantity,
         is_service, qty_on_hand, low_stock_threshold, low_stock_warning_enabled, unit, is_active,
         round(cost_price * 1.03, 2) as min_price
  from parts;
