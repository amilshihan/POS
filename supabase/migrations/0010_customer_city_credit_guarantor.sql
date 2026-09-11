alter table customers
  add column city text,
  add column credit_period_days integer not null default 0,
  add column guarantor_name text,
  add column guarantor_nic text,
  add column guarantor_mobile text;
