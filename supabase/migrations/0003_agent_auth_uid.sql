-- Helper for the reset-agent-password edge function.
--
-- updateUserById() needs the auth user's UUID, but agents link to auth users by
-- email and the `auth` schema isn't exposed to PostgREST. This SECURITY DEFINER
-- function resolves an agent_id to its auth user id so the function can use it.

CREATE OR REPLACE FUNCTION public.agent_auth_uid(p_agent_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id
  FROM auth.users au
  JOIN public.agents a ON lower(a.email) = lower(au.email)
  WHERE a.id = p_agent_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.agent_auth_uid(uuid) TO authenticated;

-- Refresh the PostgREST schema cache so the function is callable immediately
-- (avoids "Could not find the function ... in the schema cache").
NOTIFY pgrst, 'reload schema';
