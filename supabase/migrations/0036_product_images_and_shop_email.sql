-- Product photos (for promo images and general display) and a shop email
-- (for the promo image's contact details, alongside the existing phone).
alter table parts add column image_url text;
alter table shop_settings add column email text;
