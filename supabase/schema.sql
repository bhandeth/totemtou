-- Run this once in the Supabase SQL editor.
-- Captures user intent when someone clicks Book Now and signs in.

create table if not exists public.booking_intents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  email        text,
  provider     text,
  journey      text,
  departure    text,
  travellers   int,
  status       text default 'signed_in',   -- signed_in | paid | cancelled
  booking_ref  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists booking_intents_user_id_idx on public.booking_intents(user_id);
create index if not exists booking_intents_status_idx  on public.booking_intents(status);

alter table public.booking_intents enable row level security;

-- Owners can read/write their own rows; the publishable anon key uses the
-- signed-in user's JWT, so RLS enforces isolation.
drop policy if exists "intents_own_select" on public.booking_intents;
create policy "intents_own_select" on public.booking_intents
  for select using (auth.uid() = user_id);

drop policy if exists "intents_own_insert" on public.booking_intents;
create policy "intents_own_insert" on public.booking_intents
  for insert with check (auth.uid() = user_id);

drop policy if exists "intents_own_update" on public.booking_intents;
create policy "intents_own_update" on public.booking_intents
  for update using (auth.uid() = user_id);

-- WhatsApp OTP codes. Rows are only ever read/written by the service-role
-- key inside the Edge Functions; RLS below denies all client access.
create table if not exists public.otp_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  code_hash   text not null,
  attempts    int  default 0,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz default now()
);
create index if not exists otp_codes_phone_idx on public.otp_codes(phone);

alter table public.otp_codes enable row level security;
-- No policies = no client access. Service role bypasses RLS.

-- Optional: prune expired codes automatically (run as a cron job)
-- select cron.schedule('otp_prune','*/15 * * * *',
--   $$delete from public.otp_codes where expires_at < now() - interval '1 day'$$);


-- ============================================================================
-- SIGNUPS — one row per "Send WhatsApp OTP" click. Powers the admin screen
-- and the traveller's "applied journeys" list. Captures name, email, phone,
-- journey and the moment they signed in.
-- ============================================================================
create table if not exists public.signups (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  name          text,
  email         text,
  phone         text,
  journey       text,                          -- e.g. "Annapurna Base Camp"
  journey_code  text,                          -- e.g. "ABC"
  provider      text,                          -- google | strava
  departure     text,
  travellers    int,
  status        text default 'applied',        -- applied | payment | intake | first_call | ready | paid | cancelled
  created_at    timestamptz default now()      -- time of login / OTP request
);
create index if not exists signups_user_id_idx on public.signups(user_id);
create index if not exists signups_created_at_idx on public.signups(created_at desc);

alter table public.signups enable row level security;

-- A signed-in traveller can create and read/update their own signups.
-- The admin screen never uses the anon key — it goes through the
-- admin-list Edge Function (service role), so no public-read policy exists.
drop policy if exists "signups_own_insert" on public.signups;
create policy "signups_own_insert" on public.signups
  for insert with check (auth.uid() = user_id);

drop policy if exists "signups_own_select" on public.signups;
create policy "signups_own_select" on public.signups
  for select using (auth.uid() = user_id);

drop policy if exists "signups_own_update" on public.signups;
create policy "signups_own_update" on public.signups
  for update using (auth.uid() = user_id);


-- ============================================================================
-- PROFILES — one row per traveller. Holds the display name, the one-time
-- "alternate name" fellow travellers see, and an avatar. Editable by the owner.
-- ============================================================================
create table if not exists public.profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  alternate_name  text,                        -- one-time choice (enforced app-side + trigger below)
  avatar_url      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_own_all" on public.profiles;
create policy "profiles_own_all" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Enforce the alternate_name "one-time" rule at the database level: once it is
-- set to a non-null value it cannot be changed (only the service role bypasses).
create or replace function public.lock_alternate_name()
returns trigger language plpgsql as $$
begin
  if old.alternate_name is not null and old.alternate_name <> ''
     and new.alternate_name is distinct from old.alternate_name then
    raise exception 'alternate_name is a one-time choice and cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_lock_alt_name on public.profiles;
create trigger profiles_lock_alt_name
  before update on public.profiles
  for each row execute function public.lock_alternate_name();
