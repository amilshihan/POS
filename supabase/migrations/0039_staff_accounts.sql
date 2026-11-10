-- Staff accounts get a username + admin-set temporary password instead of
-- an email invite link, plus NIC/mobile capture and a forced
-- change-password-on-first-login flow.
--
-- Supabase Auth is still email-based under the hood: a username-only
-- account is created with a synthetic email (see lib/staffAuth.ts,
-- usernameToEmail()) that's never actually sent anywhere. The login page
-- accepts either a real email (existing accounts) or a username and maps
-- it to that synthetic address before calling signInWithPassword.
alter table profiles
  add column username text unique,
  add column nic_no text,
  add column must_change_password boolean not null default false;

-- Lets a user clear their own forced-password-change flag right after
-- auth.updateUser({password}) succeeds, without widening the self-update
-- RLS policy to let them touch it directly.
create function clear_must_change_password() returns void
  language plpgsql security definer set search_path = public as $$
begin
  update profiles set must_change_password = false where id = auth.uid();
end;
$$;

-- profiles_update_self_name (auth.uid() = id) lets a user update their own
-- row with no column restriction, which — before this trigger — meant a
-- cashier could set their own role to 'admin'. Block self-updates to the
-- sensitive columns; admin (RLS-authenticated) and the service-role key
-- (our server API routes) are unaffected.
create function restrict_self_profile_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' and not is_admin(auth.uid()) then
    if new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.username is distinct from old.username
      or new.must_change_password is distinct from old.must_change_password then
      raise exception 'Only an admin can change role, active status, username, or the password-reset flag.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_restrict_self_profile_update
  before update on profiles
  for each row execute function restrict_self_profile_update();

-- "My Profile" is reachable by every role regardless of Settings ->
-- Permissions — see lib/permissions.ts / lib/menuItems.ts.
