-- Support for the reset-agent-password edge function.
--
-- Agents are linked to auth users by email (no user_id column), and the `auth`
-- schema isn't exposed to PostgREST. This SECURITY DEFINER helper resolves an
-- agent_id to its auth user id so the function can call updateUserById().
-- Execute is granted to service_role only (the edge function uses it).

create or replace function public.agent_auth_uid(p_agent_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.agents a
  join auth.users u on lower(u.email) = lower(a.email)
  where a.id = p_agent_id
  limit 1;
$$;

revoke all on function public.agent_auth_uid(uuid) from public;
grant execute on function public.agent_auth_uid(uuid) to service_role;
