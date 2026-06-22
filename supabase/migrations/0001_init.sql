-- BookMax upsell capture — initial schema + Row Level Security.
--
-- Multi-tenant model: every hotel is a client. Agents (linked to a Supabase
-- auth user by email) may only read/write their own hotel's data. Vendor
-- admins (us) can read every hotel's data for daily reconciliation.
--
-- Linking strategy: an auth user is matched to an `agents` row by email
-- (agents.email = auth.email()). Vendor admins are listed in `vendor_admins`
-- by email. Both lookups run through SECURITY DEFINER helper functions so the
-- policies don't recurse back into the tables they protect.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.hotels (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  timezone   text        not null default 'UTC',
  created_at timestamptz not null default now()
);

create table if not exists public.agents (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hotels(id) on delete cascade,
  name       text not null,
  email      text not null,
  agent_code text not null,
  created_at timestamptz not null default now(),
  unique (email),
  unique (hotel_id, agent_code)
);

create table if not exists public.captures (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hotels(id) on delete cascade,
  agent_id     uuid not null references public.agents(id) on delete restrict,
  confirmation text not null,
  product      text not null,
  type         text not null check (type in ('Room', 'Other')),
  qty          integer       not null default 1 check (qty > 0),
  unit_price   numeric(10,2) not null default 0 check (unit_price >= 0),
  amount       numeric(10,2) not null default 0 check (amount >= 0),
  captured_at  timestamptz   not null default now()
);

create index if not exists captures_hotel_time_idx on public.captures (hotel_id, captured_at desc);
create index if not exists captures_agent_idx       on public.captures (agent_id);
create index if not exists captures_confirmation_idx on public.captures (confirmation);
create index if not exists agents_email_idx          on public.agents (lower(email));

-- Vendor (cross-hotel) admins. Managed in SQL, not via the client API.
create table if not exists public.vendor_admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER → bypass RLS, so policies can't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_vendor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vendor_admins
    where lower(email) = lower(auth.email())
  );
$$;

create or replace function public.current_hotel_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hotel_id from public.agents
  where lower(email) = lower(auth.email())
  limit 1;
$$;

revoke all on function public.is_vendor() from public;
revoke all on function public.current_hotel_id() from public;
grant execute on function public.is_vendor() to authenticated;
grant execute on function public.current_hotel_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.hotels        enable row level security;
alter table public.agents        enable row level security;
alter table public.captures      enable row level security;
alter table public.vendor_admins enable row level security;

-- Hotels: agents see their own hotel; vendor sees all.
drop policy if exists hotels_select on public.hotels;
create policy hotels_select on public.hotels
  for select to authenticated
  using (public.is_vendor() or id = public.current_hotel_id());

-- Agents: agents see colleagues in their hotel; vendor sees all.
drop policy if exists agents_select on public.agents;
create policy agents_select on public.agents
  for select to authenticated
  using (public.is_vendor() or hotel_id = public.current_hotel_id());

-- Captures: read own hotel (or all, for vendor).
drop policy if exists captures_select on public.captures;
create policy captures_select on public.captures
  for select to authenticated
  using (public.is_vendor() or hotel_id = public.current_hotel_id());

-- Captures: an agent may insert only for themselves, in their own hotel.
-- Vendor may insert on any hotel's behalf.
drop policy if exists captures_insert on public.captures;
create policy captures_insert on public.captures
  for insert to authenticated
  with check (
    public.is_vendor()
    or (
      hotel_id = public.current_hotel_id()
      and agent_id in (
        select id from public.agents where lower(email) = lower(auth.email())
      )
    )
  );

-- Captures: void = delete. An agent may delete their own captures; vendor any.
drop policy if exists captures_delete on public.captures;
create policy captures_delete on public.captures
  for delete to authenticated
  using (
    public.is_vendor()
    or agent_id in (
      select id from public.agents where lower(email) = lower(auth.email())
    )
  );

-- Vendor admins list is readable only by vendor admins.
drop policy if exists vendor_admins_select on public.vendor_admins;
create policy vendor_admins_select on public.vendor_admins
  for select to authenticated
  using (public.is_vendor());
