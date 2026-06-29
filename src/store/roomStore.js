import { supabase } from '../lib/supabase';

// Room upgrade ranks (room_types table). Falls back to the static catalog rank
// when the table is empty/unavailable, so the capture form still works.
export async function fetchRoomRanks() {
  const { data, error } = await supabase.from('room_types').select('id, type, rank').order('rank');
  if (error) throw error;
  return data;
}

// Persist a new ordering (optimistic caller). Upserts every row's rank by id.
export async function saveRoomRanks(items) {
  const { error } = await supabase
    .from('room_types')
    .upsert(items.map((i) => ({ id: i.id, type: i.type, rank: i.rank })), { onConflict: 'id' });
  if (error) throw error;
}
