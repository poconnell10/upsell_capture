-- Admin panel support: soft-delete (active flags) + vendor management policies.
-- Additive migration; safe to run after 0001_init.sql.

-- ---------------------------------------------------------------------------
-- Soft-delete columns
-- ---------------------------------------------------------------------------
alter table public.hotels add column if not exists active boolean not null default true;
alter table public.agents add column if not exists active boolean not null default true;

-- ---------------------------------------------------------------------------
-- A deactivated agent loses all access: current_hotel_id() only resolves for
-- ACTIVE agents, so the email→hotel mapping returns null once deactivated.
-- ---------------------------------------------------------------------------
create or replace function public.current_hotel_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hotel_id from public.agents
  where lower(email) = lower(auth.email()) and active
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Select policies: hide inactive records from agents; vendors still see all.
-- ---------------------------------------------------------------------------
drop policy if exists hotels_select on public.hotels;
create policy hotels_select on public.hotels
  for select to authenticated
  using (public.is_vendor() or (active and id = public.current_hotel_id()));

drop policy if exists agents_select on public.agents;
create policy agents_select on public.agents
  for select to authenticated
  using (public.is_vendor() or (active and hotel_id = public.current_hotel_id()));

-- Captures: only active agents may insert/void.
drop policy if exists captures_insert on public.captures;
create policy captures_insert on public.captures
  for insert to authenticated
  with check (
    public.is_vendor()
    or (
      hotel_id = public.current_hotel_id()
      and agent_id in (
        select id from public.agents
        where lower(email) = lower(auth.email()) and active
      )
    )
  );

drop policy if exists captures_delete on public.captures;
create policy captures_delete on public.captures
  for delete to authenticated
  using (
    public.is_vendor()
    or agent_id in (
      select id from public.agents
      where lower(email) = lower(auth.email()) and active
    )
  );

-- ---------------------------------------------------------------------------
-- Vendor admins manage hotels and agents (the admin panel writes directly;
-- the privileged auth invite goes through the invite-agent edge function).
-- ---------------------------------------------------------------------------
drop policy if exists hotels_insert on public.hotels;
create policy hotels_insert on public.hotels
  for insert to authenticated
  with check (public.is_vendor());

drop policy if exists hotels_update on public.hotels;
create policy hotels_update on public.hotels
  for update to authenticated
  using (public.is_vendor())
  with check (public.is_vendor());

drop policy if exists agents_insert on public.agents;
create policy agents_insert on public.agents
  for insert to authenticated
  with check (public.is_vendor());

drop policy if exists agents_update on public.agents;
create policy agents_update on public.agents
  for update to authenticated
  using (public.is_vendor())
  with check (public.is_vendor());
