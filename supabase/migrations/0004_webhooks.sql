-- Webhook integration: per-hotel + global (IN-Gauge) outbound webhooks.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_configs (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid references public.hotels(id) on delete cascade, -- null = global / IN-Gauge
  name       text not null,
  url        text not null,
  secret     text not null,                  -- Bearer token sent in Authorization header
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- One webhook per hotel for the demo (globals, hotel_id null, are unrestricted).
create unique index if not exists webhook_configs_one_per_hotel
  on public.webhook_configs (hotel_id) where hotel_id is not null;

create table if not exists public.webhook_logs (
  id                uuid primary key default gen_random_uuid(),
  webhook_config_id uuid references public.webhook_configs(id) on delete cascade,
  capture_id        uuid references public.captures(id) on delete set null,
  status            text not null check (status in ('success', 'failed')),
  attempts          integer not null default 1,
  response_code     integer,
  error_text        text,
  fired_at          timestamptz not null default now()
);

create index if not exists webhook_logs_fired_idx  on public.webhook_logs (fired_at desc);
create index if not exists webhook_logs_config_idx on public.webhook_logs (webhook_config_id, fired_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.webhook_configs enable row level security;
alter table public.webhook_logs    enable row level security;

-- Base table is vendor-only. Agents read a masked projection via the RPC below,
-- so the raw `secret` is never exposed to them.
drop policy if exists webhook_configs_select on public.webhook_configs;
create policy webhook_configs_select on public.webhook_configs
  for select to authenticated using (public.is_vendor());

drop policy if exists webhook_configs_insert on public.webhook_configs;
create policy webhook_configs_insert on public.webhook_configs
  for insert to authenticated with check (public.is_vendor());

drop policy if exists webhook_configs_update on public.webhook_configs;
create policy webhook_configs_update on public.webhook_configs
  for update to authenticated using (public.is_vendor()) with check (public.is_vendor());

drop policy if exists webhook_configs_delete on public.webhook_configs;
create policy webhook_configs_delete on public.webhook_configs
  for delete to authenticated using (public.is_vendor());

-- Logs are vendor-only (writes happen via the edge function / service role).
drop policy if exists webhook_logs_select on public.webhook_logs;
create policy webhook_logs_select on public.webhook_logs
  for select to authenticated using (public.is_vendor());

-- ---------------------------------------------------------------------------
-- Agent self-service: masked view of their own hotel's webhook + last fire.
-- SECURITY DEFINER so it can read the (vendor-only) tables, but it never
-- returns the raw secret — only the last 8 characters.
-- ---------------------------------------------------------------------------
create or replace function public.current_hotel_webhook()
returns table (
  id           uuid,
  hotel_id     uuid,
  name         text,
  url          text,
  active       boolean,
  created_at   timestamptz,
  secret_last8 text,
  last_fired   timestamptz,
  last_status  text
)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.hotel_id, w.name, w.url, w.active, w.created_at,
         right(w.secret, 8) as secret_last8,
         l.fired_at as last_fired,
         l.status   as last_status
  from public.webhook_configs w
  left join lateral (
    select status, fired_at
    from public.webhook_logs
    where webhook_config_id = w.id
    order by fired_at desc
    limit 1
  ) l on true
  where w.hotel_id = public.current_hotel_id()
  order by w.created_at desc
  limit 1;
$$;

revoke all on function public.current_hotel_webhook() from public;
grant execute on function public.current_hotel_webhook() to authenticated;

-- ---------------------------------------------------------------------------
-- Demo seed (idempotent)
-- ---------------------------------------------------------------------------
insert into public.webhook_configs (hotel_id, name, url, secret)
select null, 'IN-Gauge Global', 'https://webhook.site/dummy-ingauge-global', 'sk_ingauge_demo_secret_key'
where not exists (select 1 from public.webhook_configs where name = 'IN-Gauge Global');

insert into public.webhook_configs (hotel_id, name, url, secret)
select h.id, 'Hotel Self-Service Demo', 'https://webhook.site/dummy-hotel-endpoint', 'sk_hotel_demo_secret_key'
from public.hotels h
where not exists (select 1 from public.webhook_configs w where w.hotel_id = h.id)
order by h.created_at
limit 1;

notify pgrst, 'reload schema';
