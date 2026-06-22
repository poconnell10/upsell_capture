import { supabase } from '../lib/supabase';

// Data-access layer for captures. Replaces the old genRows() mock generator
// with real Supabase queries: fetch (with date-range + agent filters), insert,
// and delete (void). Returned rows are mapped to the shape the UI already uses.

const SELECT =
  'id, hotel_id, agent_id, confirmation, product, type, qty, unit_price, amount, captured_at, agent:agents(name, agent_code)';

// Calendar-day difference so DLABEL can still render "Today / Yesterday / Nd ago".
function daysAgoFrom(iso) {
  const d = new Date(iso);
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b - a) / 86400000);
}

function toRow(c) {
  return {
    id: c.id,
    capturedAt: c.captured_at,
    daysAgo: daysAgoFrom(c.captured_at),
    conf: c.confirmation,
    agentUuid: c.agent_id,
    agentId: c.agent?.agent_code ?? c.agent_id, // display code
    agent: c.agent?.name ?? '',
    product: c.product,
    type: c.type,
    qty: c.qty,
    unit: Number(c.unit_price),
    amount: Number(c.amount),
  };
}

const iso = (v) => (v instanceof Date ? v.toISOString() : v);

// Fetch captures, newest first. Optional { from, to } (Date or ISO string,
// half-open [from, to)) and { agentId } (an agents.id uuid).
export async function fetchCaptures({ from, to, agentId } = {}) {
  let q = supabase.from('captures').select(SELECT).order('captured_at', { ascending: false });
  if (from) q = q.gte('captured_at', iso(from));
  if (to) q = q.lt('captured_at', iso(to));
  if (agentId) q = q.eq('agent_id', agentId);
  const { data, error } = await q;
  if (error) throw error;
  return data.map(toRow);
}

// Insert many capture lines in one round-trip. Each line:
//   { hotelId, agentId, confirmation, product, type, qty, unitPrice, amount, capturedAt? }
export async function insertCaptures(lines) {
  const payload = lines.map((l) => ({
    hotel_id: l.hotelId,
    agent_id: l.agentId,
    confirmation: l.confirmation,
    product: l.product,
    type: l.type,
    qty: l.qty ?? 1,
    unit_price: l.unitPrice ?? 0,
    amount: l.amount ?? 0,
    ...(l.capturedAt ? { captured_at: l.capturedAt } : {}),
  }));
  const { data, error } = await supabase.from('captures').insert(payload).select(SELECT);
  if (error) throw error;
  // Fire outbound webhooks (global + hotel) — fire-and-forget, never block the UI.
  for (const c of data) {
    supabase.functions.invoke('capture-webhook', { body: { capture_id: c.id } }).catch(() => {});
  }
  return data.map(toRow);
}

export async function insertCapture(line) {
  const [row] = await insertCaptures([line]);
  return row;
}

// Void a capture line by id.
export async function deleteCapture(id) {
  const { error } = await supabase.from('captures').delete().eq('id', id);
  if (error) throw error;
}

// Void every line under a confirmation (the Capture Sale "View → Void" action).
export async function deleteCaptures(ids) {
  if (!ids.length) return;
  const { error } = await supabase.from('captures').delete().in('id', ids);
  if (error) throw error;
}

// Agents visible to the current user (own hotel, or all for vendor) — used to
// populate filter/select controls.
export async function fetchAgents() {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, agent_code, hotel_id')
    .order('name');
  if (error) throw error;
  return data;
}

// Roll capture line items up by confirmation number for summary displays.
export function groupByConfirmation(rows) {
  const m = new Map();
  for (const r of rows) {
    const g = m.get(r.conf) || { conf: r.conf, agent: r.agent, agentId: r.agentId, lines: [], total: 0 };
    g.lines.push(r);
    g.total += r.amount;
    m.set(r.conf, g);
  }
  return [...m.values()];
}

// Date-range bounds for the dashboard's Today / MTD / All toggle.
export function rangeBounds(range) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today') return { from: startOfToday, to: null };
  if (range === 'all') return { from: null, to: null };
  // mtd
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
}
