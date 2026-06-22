import { supabase } from '../lib/supabase';

// Webhook management (vendor) + self-service read (agent).

// --- Vendor: webhook configs ----------------------------------------------
export async function fetchWebhookConfigs() {
  const { data, error } = await supabase
    .from('webhook_configs')
    .select('id, hotel_id, name, url, active, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createWebhookConfig({ hotelId = null, name, url, secret }) {
  const { data, error } = await supabase
    .from('webhook_configs')
    .insert({ hotel_id: hotelId, name: name.trim(), url: url.trim(), secret: secret.trim() })
    .select('id, hotel_id, name, url, active, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function setWebhookActive(id, active) {
  const { error } = await supabase.from('webhook_configs').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deleteWebhookConfig(id) {
  const { error } = await supabase.from('webhook_configs').delete().eq('id', id);
  if (error) throw error;
}

// --- Vendor: logs ----------------------------------------------------------
export async function fetchWebhookLogs(limit = 50) {
  const { data, error } = await supabase
    .from('webhook_logs')
    .select(
      'id, status, attempts, response_code, error_text, fired_at, webhook_config:webhook_configs(name), capture:captures(confirmation)',
    )
    .order('fired_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((l) => ({
    id: l.id,
    status: l.status,
    attempts: l.attempts,
    responseCode: l.response_code,
    errorText: l.error_text,
    firedAt: l.fired_at,
    webhookName: l.webhook_config?.name ?? '(deleted)',
    configId: l.webhook_config?.id,
    confirmation: l.capture?.confirmation ?? '—',
  }));
}

// Most recent fire per config, for the "Last fired / Last status" columns.
export async function fetchLastFires() {
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('webhook_config_id, status, fired_at')
    .order('fired_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const byConfig = {};
  for (const l of data) {
    if (!byConfig[l.webhook_config_id]) {
      byConfig[l.webhook_config_id] = { firedAt: l.fired_at, status: l.status };
    }
  }
  return byConfig;
}

// Vendor tests a specific webhook config.
export async function testWebhookConfig(webhookConfigId) {
  const { data, error } = await supabase.functions.invoke('capture-webhook', {
    body: { test: true, webhook_config_id: webhookConfigId },
  });
  if (error) {
    let message = error.message;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch {
      /* keep generic */
    }
    return { ok: false, error: message };
  }
  return { ok: true, results: data?.results ?? [] };
}

// --- Agent self-service ----------------------------------------------------
// Masked view of the agent's own hotel webhook (no raw secret).
export async function fetchMyHotelWebhook() {
  const { data, error } = await supabase.rpc('current_hotel_webhook');
  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

// Agent tests their own hotel webhook.
export async function testMyWebhook() {
  const { data, error } = await supabase.functions.invoke('capture-webhook', { body: { test: true } });
  if (error) {
    let message = error.message;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch {
      /* keep generic */
    }
    return { ok: false, error: message };
  }
  return { ok: true, results: data?.results ?? [] };
}
