-- Per-role menu permissions, managed from Settings -> Permissions. A
-- missing row means "enabled" (the historical default of everyone seeing
-- everything their role's section exposed); a row with enabled = false
-- hides the item from the sidebar AND blocks the page itself (enforced in
-- lib/supabase/middleware.ts), not just the nav link.
create table menu_permissions (
  role text not null check (role in ('admin', 'cashier')),
  path text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (role, path)
);

alter table menu_permissions enable row level security;

create policy "menu_permissions_select" on menu_permissions
  for select using (auth.uid() is not null);

create policy "menu_permissions_write_admin" on menu_permissions
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Seed cashiers with the same admin-only sections that were previously
-- just hidden from their nav, so behavior doesn't change until an admin
-- deliberately opens one of these up from the new Permissions tab.
insert into menu_permissions (role, path, enabled) values
  ('cashier', '/packages', false),
  ('cashier', '/suppliers', false),
  ('cashier', '/purchases', false),
  ('cashier', '/purchases/new', false),
  ('cashier', '/expenses', false),
  ('cashier', '/reports', false),
  ('cashier', '/finance', false),
  ('cashier', '/promo', false),
  ('cashier', '/users', false),
  ('cashier', '/settings', false);
