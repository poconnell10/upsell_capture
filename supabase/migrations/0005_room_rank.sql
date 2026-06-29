-- Room upgrade hierarchy: rank per room type (lower rank = lower tier).
-- Source of truth for "valid upgrades only" in the capture form. Seeded from the
-- catalog's display order; reorderable by vendors on the Rooms & Rates page.

create table if not exists public.room_types (
  id         text primary key,        -- matches the catalog room id (e.g. 'std-k')
  type       text not null,
  rank       integer not null,
  created_at timestamptz not null default now()
);

alter table public.room_types enable row level security;

-- Everyone signed in can read ranks (the capture form needs them).
drop policy if exists room_types_select on public.room_types;
create policy room_types_select on public.room_types
  for select to authenticated using (true);

-- Only vendor admins reorder.
drop policy if exists room_types_write on public.room_types;
create policy room_types_write on public.room_types
  for all to authenticated using (public.is_vendor()) with check (public.is_vendor());

-- Seed from the current catalog display order.
insert into public.room_types (id, type, rank) values
  ('std-k', 'Standard King',     1),
  ('dlx-k', 'Deluxe King',       2),
  ('exec',  'Executive Room',    3),
  ('dvr',   'Disney View Room',  4),
  ('corn',  'Corner Room',       5),
  ('suite', 'Suite',             6)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
