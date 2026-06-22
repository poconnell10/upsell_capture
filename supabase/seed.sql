-- Optional dev seed. Run after 0001_init.sql.
--
-- Auth users are created through Supabase Auth (the login page / dashboard),
-- not here. To let a signed-up user act as an agent, insert an `agents` row
-- whose email matches their auth email. To make someone a vendor admin, add
-- their email to `vendor_admins`.

insert into public.hotels (id, name, timezone)
values
  ('11111111-1111-1111-1111-111111111111', 'Grand Horizon', 'America/New_York'),
  ('22222222-2222-2222-2222-222222222222', 'Harbour View',  'Europe/Dublin')
on conflict (id) do nothing;

-- Example: link an agent to a real auth user (replace the email with one you
-- have signed up via the login page).
--
-- insert into public.agents (hotel_id, name, email, agent_code) values
--   ('11111111-1111-1111-1111-111111111111', 'Maria Chen', 'maria@grandhorizon.test', 'ING-1042')
-- on conflict (email) do nothing;
--
-- Example: grant vendor (all-hotels) access.
--
-- insert into public.vendor_admins (email) values ('ops@bookmax.test')
-- on conflict (email) do nothing;
