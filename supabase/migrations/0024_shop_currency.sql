-- Shop-wide currency, selectable from Settings > General and shown
-- everywhere a money amount is displayed. LKR ("Rs.") is the default to
-- match the existing shop.

alter table shop_settings add column currency text not null default 'LKR';
