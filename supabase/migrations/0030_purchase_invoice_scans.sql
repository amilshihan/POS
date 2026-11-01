-- Scan a purchase invoice (photo/PDF), let AI pre-fill supplier + line item
-- details (cost, retail price, discount), and keep the uploaded file on hand
-- to refer back to later.

alter table purchases
  add column invoice_number text,
  add column invoice_date date,
  add column discount numeric(12,2) not null default 0;

alter table purchase_items
  add column discount numeric(12,2) not null default 0,
  add column retail_price numeric(12,2);

create table purchase_invoice_scans (
  id uuid primary key default gen_random_uuid(),
  file_url text not null,
  file_name text,
  extracted_data jsonb,
  purchase_id uuid references purchases(id) on delete set null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table purchase_invoice_scans enable row level security;
create policy "purchase_invoice_scans_all" on purchase_invoice_scans for all using (auth.uid() is not null);

insert into storage.buckets (id, name, public)
values ('purchase-invoices', 'purchase-invoices', true)
on conflict (id) do nothing;

create policy "Public read purchase-invoices"
  on storage.objects for select
  using (bucket_id = 'purchase-invoices');

create policy "Authenticated upload purchase-invoices"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'purchase-invoices');

-- A purchase line now carries the retail price seen on the invoice (if any),
-- used to keep the product's listed retail price in sync when restocking.
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
          retail_price = coalesce(new.retail_price, retail_price),
          updated_at = now()
      where id = new.part_id;
    insert into stock_movements (part_id, change_qty, reason, ref_id, created_by)
    values (new.part_id, new.qty, 'purchase', new.purchase_id,
            (select purchased_by from purchases where id = new.purchase_id));
  else
    update parts
      set cost_price = new.unit_cost,
          retail_price = coalesce(new.retail_price, retail_price),
          updated_at = now()
      where id = new.part_id;
  end if;
  return new;
end;
$$;
