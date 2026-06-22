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

// Send a password-setup invite via the edge function (service role, server-side).
// Returns { ok, error } — a failed invite does not undo agent creation.
export async function inviteAgent(email, redirectTo) {
  const { data, error } = await supabase.functions.invoke('invite-agent', {
    body: { email, redirectTo },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}
