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
