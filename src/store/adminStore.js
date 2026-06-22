import { supabase } from '../lib/supabase';

// Vendor-admin data layer. All writes require a vendor session (enforced by RLS);
// the auth invite is delegated to the `invite-agent` edge function because it
// needs the service-role key and must never run in the browser.

// Common timezones offered when creating/editing a hotel.
export const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

// --- Hotels ----------------------------------------------------------------

// All hotels (incl. inactive, for vendors) with their active-agent counts.
export async function fetchHotelsWithCounts() {
  const [hotelsRes, agentsRes] = await Promise.all([
    supabase.from('hotels').select('id, name, timezone, created_at, active').order('created_at', { ascending: true }),
    supabase.from('agents').select('id, hotel_id, active'),
  ]);
  if (hotelsRes.error) throw hotelsRes.error;
  if (agentsRes.error) throw agentsRes.error;
  const counts = {};
  for (const a of agentsRes.data) {
    if (a.active) counts[a.hotel_id] = (counts[a.hotel_id] || 0) + 1;
  }
  return hotelsRes.data.map((h) => ({ ...h, agentCount: counts[h.id] || 0 }));
}

export async function fetchHotel(hotelId) {
  const { data, error } = await supabase
    .from('hotels')
    .select('id, name, timezone, created_at, active')
    .eq('id', hotelId)
    .single();
  if (error) throw error;
  return data;
}

export async function createHotel({ name, timezone }) {
  const { data, error } = await supabase
    .from('hotels')
    .insert({ name: name.trim(), timezone })
    .select('id, name, timezone, created_at, active')
    .single();
  if (error) throw error;
  return data;
}

export async function updateHotel(id, patch) {
  const { data, error } = await supabase
    .from('hotels')
    .update(patch)
    .eq('id', id)
    .select('id, name, timezone, created_at, active')
    .single();
  if (error) throw error;
  return data;
}

export function setHotelActive(id, active) {
  return updateHotel(id, { active });
}

// --- Agents ----------------------------------------------------------------

// All agents for a hotel (incl. inactive, so admins can manage them).
export async function fetchHotelAgents(hotelId) {
  const { data, error } = await supabase
    .from('agents')
    .select('id, hotel_id, name, email, agent_code, created_at, active')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createAgent({ hotelId, name, email, agentCode }) {
  const { data, error } = await supabase
    .from('agents')
    .insert({ hotel_id: hotelId, name: name.trim(), email: email.trim(), agent_code: agentCode.trim() })
    .select('id, hotel_id, name, email, agent_code, created_at, active')
    .single();
  if (error) throw error;
  return data;
}

export function setAgentActive(id, active) {
  return supabase
    .from('agents')
    .update({ active })
    .eq('id', id)
    .select('id, hotel_id, name, email, agent_code, created_at, active')
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
}

// Invoke an edge function and normalise the result to { ok, error }. A non-2xx
// response surfaces as a FunctionsHttpError whose body holds our JSON error.
async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch {
      /* keep the generic message */
    }
    return { ok: false, error: message };
  }
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

// Send a password-setup invite via the edge function (service role, server-side).
// Returns { ok, error } — a failed invite does not undo agent creation.
export function inviteAgent(email, redirectTo) {
  return invokeFunction('invite-agent', { email, redirectTo });
}

// Vendor admin sets an agent's password directly (no email). Server-side edge
// function, service role only. Returns { ok, error }.
export function resetAgentPassword(agentId, newPassword) {
  return invokeFunction('reset-agent-password', { agent_id: agentId, new_password: newPassword });
}
