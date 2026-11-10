-- Custom staff roles. Previously `profiles.role` was a fixed Postgres enum
-- ('admin' | 'cashier'). Admin can now define additional roles from
-- Settings -> Permissions (e.g. "Workshop Manager"), each with its own
-- menu access, so the column becomes free text backed by this table
-- instead of a fixed enum.
create table roles (
  name text primary key,
  label text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

insert into roles (name, label, is_system) values
  ('admin', 'Admin', true),
  ('cashier', 'Cashier', true);

alter table profiles alter column role drop default;
alter table profiles alter column role type text using role::text;
alter table profiles alter column role set default 'cashier';
alter table profiles add constraint profiles_role_fkey foreign key (role) references roles(name);

drop type user_role;

-- menu_permissions.role was check-constrained to ('admin','cashier');
-- replace with a foreign key so any defined role can have its own rows,
-- and deleting a role cleans up its permission rows.
alter table menu_permissions drop constraint menu_permissions_role_check;
alter table menu_permissions add constraint menu_permissions_role_fkey
  foreign key (role) references roles(name) on delete cascade;

alter table roles enable row level security;

create policy "roles_select" on roles for select using (auth.uid() is not null);
create policy "roles_write_admin" on roles for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Admin/Cashier stay fixed: the rest of the app (is_admin(), the staff
-- invite flow, default-collapsed UI states) hardcodes these two names.
create function prevent_system_role_delete() returns trigger
  language plpgsql as $$
begin
  if old.is_system then
    raise exception 'Cannot delete a built-in role.';
  end if;
  return old;
end;
$$;

create trigger trg_prevent_system_role_delete
  before delete on roles
  for each row execute function prevent_system_role_delete();

create function prevent_system_role_rename() returns trigger
  language plpgsql as $$
begin
  if old.is_system and new.name <> old.name then
    raise exception 'Cannot rename a built-in role.';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_system_role_rename
  before update on roles
  for each row execute function prevent_system_role_rename();
