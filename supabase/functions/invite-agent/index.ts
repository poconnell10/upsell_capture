// Edge Function: invite an agent by email.
//
// Runs server-side so the SERVICE_ROLE key is never exposed to the browser.
// The caller's JWT is verified to belong to a vendor admin (via the is_vendor()
// RPC) before the privileged auth.admin.inviteUserByEmail() call is made.
//
// Deploy:  supabase functions deploy invite-agent
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
//  automatically by the Supabase Functions runtime.)

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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

  let payload: { email?: string; redirectTo?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }
  const email = payload.email?.trim();
  if (!email) return json(400, { error: 'email is required.' });

  // Privileged invite — service role only.
  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    email,
    payload.redirectTo ? { redirectTo: payload.redirectTo } : undefined,
  );
  if (error) return json(400, { error: error.message });

  return json(200, { ok: true, userId: data.user?.id ?? null });
});
