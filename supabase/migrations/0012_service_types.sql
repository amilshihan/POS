create type service_category as enum (
  'routine_maintenance',
  'wear_and_tear',
  'diagnostics_engine',
  'suspension_steering',
  'electrical',
  'customization_upgrades',
  'cleaning_detailing'
);

create table service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category service_category,
  default_labor_charge numeric(12,2) not null default 0,
  estimated_time_mins integer,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table service_types enable row level security;

create policy "service_types_all" on service_types for all using (auth.uid() is not null);
