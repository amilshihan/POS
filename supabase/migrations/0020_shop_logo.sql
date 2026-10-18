-- Company logo for receipts: uploaded from Settings > Print and printed at
-- the top of every bill. Stored in a public storage bucket (receipts aren't
-- behind the app's own session, so the <img> needs an unauthenticated URL)
-- with the URL cached on shop_settings for quick reads.

alter table shop_settings add column logo_url text;

insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', true)
on conflict (id) do nothing;

create policy "Public read shop-assets"
  on storage.objects for select
  using (bucket_id = 'shop-assets');

create policy "Authenticated upload shop-assets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'shop-assets');

create policy "Authenticated update shop-assets"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'shop-assets');

create policy "Authenticated delete shop-assets"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'shop-assets');
