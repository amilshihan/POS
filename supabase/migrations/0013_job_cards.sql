create type job_card_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type job_card_priority as enum ('low', 'medium', 'high', 'urgent');
create sequence job_card_seq start 1;

create table job_cards (
  id uuid primary key default gen_random_uuid(),
  job_no text not null unique default ('JC-' || lpad(nextval('job_card_seq')::text, 6, '0')),
  customer_id uuid not null references customers(id) on delete restrict,
  vehicle_id uuid not null references vehicles(id) on delete restrict,
  meter_reading numeric(12,2),
  complaints text,
  requested_work text,
  mechanic_id uuid references profiles(id),
  status job_card_status not null default 'pending',
  priority job_card_priority not null default 'medium',
  est_completion_time timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  service_notes text,
  internal_notes text,
  total_labor_cost numeric(12,2) not null default 0,
  total_parts_cost numeric(12,2) not null default 0,
  total_amount numeric(12,2) generated always as (total_labor_cost + total_parts_cost) stored,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table job_card_services (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid not null references job_cards(id) on delete cascade,
  service_type_id uuid references service_types(id) on delete set null,
  custom_service_name text,
  labor_charge numeric(12,2) not null default 0,
  est_time_mins integer,
  performed_by uuid references profiles(id),
  description text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);

create table job_card_parts (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid not null references job_cards(id) on delete cascade,
  part_id uuid not null references parts(id),
  qty numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) generated always as (qty * unit_price) stored,
  created_at timestamptz not null default now()
);

create function recalc_job_card_totals(jc_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update job_cards set
    total_labor_cost = coalesce((select sum(labor_charge) from job_card_services where job_card_id = jc_id), 0),
    total_parts_cost = coalesce((select sum(line_total) from job_card_parts where job_card_id = jc_id), 0)
  where id = jc_id;
end;
$$;

create function trg_recalc_job_card_services() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform recalc_job_card_totals(coalesce(new.job_card_id, old.job_card_id));
  return coalesce(new, old);
end;
$$;

create trigger job_card_services_recalc
  after insert or update or delete on job_card_services
  for each row execute function trg_recalc_job_card_services();

create function trg_recalc_job_card_parts() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform recalc_job_card_totals(coalesce(new.job_card_id, old.job_card_id));
  return coalesce(new, old);
end;
$$;

create trigger job_card_parts_recalc
  after insert or update or delete on job_card_parts
  for each row execute function trg_recalc_job_card_parts();

alter table job_cards enable row level security;
alter table job_card_services enable row level security;
alter table job_card_parts enable row level security;

create policy "job_cards_all" on job_cards for all using (auth.uid() is not null);
create policy "job_card_services_all" on job_card_services for all using (auth.uid() is not null);
create policy "job_card_parts_all" on job_card_parts for all using (auth.uid() is not null);
