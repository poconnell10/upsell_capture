// Edge Function: deliver a capture to its matching webhooks (global + hotel).
//
// Invoked fire-and-forget after a capture INSERT with { capture_id }, or in
// test mode with { test: true } (agent tests their hotel webhook) /
// { test: true, webhook_config_id } (vendor tests a specific config).
//
// Deploy:  supabase functions deploy capture-webhook
// SUPABASE_URL / SUPABASE_ANON_KEY injected automatically; SERVICE_ROLE_KEY is
// a secret (used to read secrets and write logs, bypassing RLS):
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface WebhookConfig {
  id: string;
  hotel_id: string | null;
  name: string;
  url: string;
  secret: string;
}

// POST a payload to one endpoint, retrying up to `maxAttempts` (500ms apart).
async function deliver(cfg: WebhookConfig, payload: unknown, maxAttempts = 3, delayMs = 500) {
  let attempts = 0;
  let responseCode: number | null = null;
  let error: string | null = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.secret}`,
          'X-Upsell-Capture-Event': 'capture.created',
        },
        body: JSON.stringify(payload),
      });
      responseCode = res.status;
      if (res.ok) return { ok: true, attempts, responseCode, error: null };
      error = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
    } catch (e) {
      responseCode = null;
      error = String((e as Error)?.message ?? e);
    }
    if (attempts < maxAttempts) await sleep(delayMs);
  }
  return { ok: false, attempts, responseCode, error };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return json(500, { error: 'Function is missing Supabase environment configuration.' });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, serviceKey);

  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) return json(401, { error: 'Not authenticated.' });

  let body: { capture_id?: string; test?: boolean; webhook_config_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  // Log every delivery attempt's final outcome.
  const logResult = (cfgId: string, captureId: string | null, r: Awaited<ReturnType<typeof deliver>>) =>
    admin.from('webhook_logs').insert({
      webhook_config_id: cfgId,
      capture_id: captureId,
      status: r.ok ? 'success' : 'failed',
      attempts: r.attempts,
      response_code: r.responseCode,
      error_text: r.ok ? null : r.error,
    });

  // ---- Test mode -----------------------------------------------------------
  if (body.test) {
    let configs: WebhookConfig[] = [];
    if (body.webhook_config_id) {
      const { data: isVendor } = await caller.rpc('is_vendor');
      if (!isVendor) return json(403, { error: 'Vendor admin access required.' });
      const { data } = await admin.from('webhook_configs').select('*').eq('id', body.webhook_config_id);
      configs = (data as WebhookConfig[]) ?? [];
    } else {
      const { data: hotelId } = await caller.rpc('current_hotel_id');
      if (!hotelId) return json(404, { error: 'No hotel webhook to test.' });
      const { data } = await admin
        .from('webhook_configs')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('active', true);
      configs = (data as WebhookConfig[]) ?? [];
    }
    if (!configs.length) return json(404, { error: 'No active webhook configured.' });

    const testPayload = {
      event: 'capture.created',
      test: true,
      captured_at: new Date().toISOString(),
      hotel_id: configs[0].hotel_id,
      hotel: '(test)',
      agent_id: null,
      agent: 'Test Agent',
      agent_code: 'TEST',
      confirmation: 'TEST-WEBHOOK',
      product: 'Suite upgrade',
      type: 'Room',
      qty: 1,
      unit_price: 160.0,
      amount: 160.0,
    };

    const results = [];
    for (const cfg of configs) {
      const r = await deliver(cfg, testPayload);
      await logResult(cfg.id, null, r);
      results.push({ name: cfg.name, ok: r.ok, response_code: r.responseCode, attempts: r.attempts });
    }
    return json(200, { ok: true, results });
  }

  // ---- Capture delivery ----------------------------------------------------
  const captureId = body.capture_id?.trim();
  if (!captureId) return json(400, { error: 'capture_id is required.' });

  // Fetch via the caller's client so RLS confirms they may see this capture.
  const { data: cap, error: capErr } = await caller
    .from('captures')
    .select(
      'id, hotel_id, agent_id, confirmation, product, type, qty, unit_price, amount, captured_at, hotel:hotels(name), agent:agents(name, agent_code)',
    )
    .eq('id', captureId)
    .maybeSingle();
  if (capErr) return json(500, { error: capErr.message });
  if (!cap) return json(404, { error: 'Capture not found or not permitted.' });

  // Matching active webhooks: global (hotel_id null) or this hotel's.
  const { data: cfgData, error: cfgErr } = await admin
    .from('webhook_configs')
    .select('*')
    .eq('active', true)
    .or(`hotel_id.is.null,hotel_id.eq.${cap.hotel_id}`);
  if (cfgErr) return json(500, { error: cfgErr.message });
  const configs = (cfgData as WebhookConfig[]) ?? [];

  const payload = {
    event: 'capture.created',
    captured_at: cap.captured_at,
    hotel_id: cap.hotel_id,
    hotel: cap.hotel?.name ?? null,
    agent_id: cap.agent_id,
    agent: cap.agent?.name ?? null,
    agent_code: cap.agent?.agent_code ?? null,
    confirmation: cap.confirmation,
    product: cap.product,
    type: cap.type,
    qty: cap.qty,
    unit_price: Number(cap.unit_price),
    amount: Number(cap.amount),
  };

  const results = [];
  for (const cfg of configs) {
    const r = await deliver(cfg, payload);
    await logResult(cfg.id, cap.id, r);
    results.push({ name: cfg.name, ok: r.ok });
  }
  return json(200, { ok: true, fired: results.length, results });
});
