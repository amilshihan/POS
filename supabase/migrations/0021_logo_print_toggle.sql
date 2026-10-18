-- Let staff keep a logo uploaded but turn off printing it on receipts
-- (e.g. while a replacement logo is being sourced) without deleting it.

alter table shop_settings add column logo_print_enabled boolean not null default true;
