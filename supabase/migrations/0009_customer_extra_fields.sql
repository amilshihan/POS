alter table customers
  add column nic text,
  add column company_name text,
  add column email text,
  add column tax_number text,
  add column is_active boolean not null default true;
