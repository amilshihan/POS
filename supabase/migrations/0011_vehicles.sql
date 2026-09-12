create table vehicle_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references vehicle_brands(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  vehicle_number text not null unique,
  brand_id uuid references vehicle_brands(id) on delete set null,
  model_id uuid references vehicle_models(id) on delete set null,
  year integer,
  engine_number text,
  chassis_number text,
  notes text,
  created_at timestamptz not null default now()
);

alter table vehicle_brands enable row level security;
alter table vehicle_models enable row level security;
alter table vehicles enable row level security;

-- vehicles / brands / models: any logged-in staff can read and write (needed at point of service).
create policy "vehicle_brands_all" on vehicle_brands for all using (auth.uid() is not null);
create policy "vehicle_models_all" on vehicle_models for all using (auth.uid() is not null);
create policy "vehicles_all" on vehicles for all using (auth.uid() is not null);
