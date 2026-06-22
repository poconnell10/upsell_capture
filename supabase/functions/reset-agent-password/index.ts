// Edge Function: vendor admin sets an agent's password directly (no email).
//
// Runs server-side so the SERVICE_ROLE key never reaches the browser. The
// caller's JWT is verified to belong to a vendor admin (is_vendor() RPC) before
// the privileged auth.admin.updateUserById() call is made.
//
// Deploy:  supabase functions deploy reset-agent-password
// SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically by the runtime.
// SERVICE_ROLE_KEY must be set as a secret (the SUPABASE_ prefix is reserved):
//   supabase secrets set SERVICE_ROLE_KEY=<your-service-role-key>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const MIN_PASSWORD = 8;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return json(500, { error: 'Function is missing Supabase environment configuration.' });
  }

  // Verify the caller is an authenticated vendor admin, using their own JWT.
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) return json(401, { error: 'Not authenticated.' });

  const { data: isVendor, error: vendorErr } = await caller.rpc('is_vendor');
  if (vendorErr) return json(500, { error: vendorErr.message });
  if (!isVendor) return json(403, { error: 'Vendor admin access required.' });

  let payload: { agent_id?: string; new_password?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }
  const agentId = payload.agent_id?.trim();
  const newPassword = payload.new_password ?? '';
  if (!agentId) return json(400, { error: 'agent_id is required.' });
  if (newPassword.length < MIN_PASSWORD) {
    return json(400, { error: `Password must be at least ${MIN_PASSWORD} characters.` });
  }

  const admin = createClient(url, serviceKey);

  // Resolve the agent's auth user id (linked by email).
  const { data: uid, error: uidErr } = await admin.rpc('agent_auth_uid', { p_agent_id: agentId });
  if (uidErr) return json(500, { error: uidErr.message });
  if (!uid) {
    return json(404, { error: 'No auth user for this agent — they may not have accepted an invite yet.' });
  }

  const { error } = await admin.auth.admin.updateUserById(uid, { password: newPassword });
  if (error) return json(400, { error: error.message });

  return json(200, { ok: true });
});
