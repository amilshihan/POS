-- Let staff choose, from Settings, whether the cash drawer should pop open
-- automatically every time a sale receipt finishes printing.

alter table shop_settings add column auto_open_drawer_on_print boolean not null default false;
