-- 0003_profiles.sql
-- Stage 4: user profile foundation.
--
-- Design notes:
--  * One row per auth user, created by a trigger on auth.users so the client
--    never has to insert its own identity row.
--  * RLS restricts every operation to the owning user.
--  * Column-level grants limit what a user may update: display name, avatar URL
--    and preferred locale. Email, id and timestamps are not writable by clients.
--  * Financial tables are still intentionally absent (Stage 7).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext,
  display_name text not null default '',
  avatar_url text,
  preferred_locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 60),
  constraint profiles_avatar_url_https check (avatar_url is null or avatar_url ~* '^https://'),
  constraint profiles_locale_supported check (preferred_locale in ('en'))
);

comment on table public.profiles is 'Public profile data owned by each authenticated user.';
comment on column public.profiles.email is 'Mirrored from auth.users for display; never editable by clients.';

alter table public.profiles enable row level security;
-- Deliberately not FORCE: the signup trigger runs as the table owner and must be able
-- to insert the first row. Browser clients connect as `authenticated`/`anon`, which
-- are subject to RLS through the policies below.

-- Read your own row only.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Update your own row only. A with-check prevents moving a row to another user.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert or delete policies: rows are created by the trigger below and are
-- removed only when the auth user is deleted (on delete cascade).

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, preferred_locale) on public.profiles to authenticated;

-- Keep updated_at authoritative; clients cannot set it directly.
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, 'member'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger: creates the profile row for a newly registered auth user.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that already existed before this migration.
insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(u.email, 'member'), '@', 1))
from auth.users u
on conflict (id) do nothing;
