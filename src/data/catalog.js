// Single source of truth for the upsell module's sellable products.
// The prototypes each carried their own copy of this data; it now lives here
// so Capture Sale, Agent Sales, Rooms & Rates and Other Revenue stay in sync.

// Brand-level room master (inherited by each property). Availability tonight is
// derived from `total - sold` so the no-oversell guard has one number to trust.
export const ROOMS = [
  { id: 'std-k', type: 'Standard King',    bed: 'King',    occ: 2, rate: 120, total: 40, sold: 23, sellable: true, rank: 1 },
  { id: 'dlx-k', type: 'Deluxe King',      bed: 'King',    occ: 2, rate: 160, total: 24, sold: 13, sellable: true, rank: 2 },
  { id: 'exec',  type: 'Executive Room',   bed: 'King',    occ: 2, rate: 210, total: 18, sold: 9,  sellable: true, rank: 3 },
  { id: 'dvr',   type: 'Disney View Room', bed: '2 Queen', occ: 4, rate: 240, total: 12, sold: 8,  sellable: true, rank: 4 },
  { id: 'corn',  type: 'Corner Room',      bed: 'King',    occ: 3, rate: 195, total: 8,  sold: 2,  sellable: true, rank: 5 },
  { id: 'suite', type: 'Suite',            bed: 'King',    occ: 3, rate: 320, total: 10, sold: 4,  sellable: true, rank: 6 },
];

export const ROOM_TYPES = ROOMS.map((r) => r.type);
export const RT_RATE = Object.fromEntries(ROOMS.map((r) => [r.type, r.rate]));
// Upgrade hierarchy: a higher rank is a higher room tier. Default = display order;
// overridable via the room_types table (Rooms & Rates drag-to-reorder).
export const RANK_BY_TYPE = Object.fromEntries(ROOMS.map((r) => [r.type, r.rank]));

export const rateOf = (type) => (ROOMS.find((r) => r.type === type) || {}).rate || 0;
export const availOf = (type) => {
  const r = ROOMS.find((x) => x.type === type);
  return r ? r.total - r.sold : 99;
};

// Other-revenue products an agent can add to a sale, plus the wider quick-add catalog.
export const PRODUCTS = [
  { id: 'early', name: 'Early arrival', price: 35 },
  { id: 'late',  name: 'Late checkout', price: 40 },
  // `voucher: true` → quantity is nights × vouchers-per-night, priced per voucher.
  { id: 'breakfast', name: 'Breakfast voucher', price: 25, voucher: true },
];
export const OTHER_CATALOG = [
  ['Early arrival', 35],
  ['Late checkout', 40],
  ['Breakfast voucher', 25],
  ['Parking', 20],
];

// Agents that can be credited with a capture (IN-Gauge / PMS ids).
export const AGENTS = [
  ['ING-1042', 'Maria Chen'],   ['ING-1077', 'David Okafor'],  ['ING-1090', 'Sofia Rossi'],
  ['PMS-2031', 'James Whelan'],  ['ING-1108', 'Aoife Brennan'], ['PMS-2055', 'Lars Olsen'],
  ['ING-1124', 'Priya Nair'],    ['ING-1136', 'Tom Becker'],    ['PMS-2078', 'Lena Fischer'],
  ['ING-1150', 'Marco Conti'],
];
export const agentName = (id) => (AGENTS.find((a) => a[0] === id) || [])[1] || id;

export const RATE_PLANS = [
  { id: 'bar',   name: 'BAR · Best Available', basis: 'Per night', cancel: 'Flexible · free to 48h', default: true },
  { id: 'flex',  name: 'Flexible',             basis: 'Per night', cancel: 'Free to 24h',           default: false },
  { id: 'promo', name: 'Advance Purchase',     basis: 'Per stay',  cancel: 'Non-refundable',        default: false },
];

// Tax rates differ by revenue category — the reason this can't be one global %.
export const INIT_TAXES = [
  { id: 'room',  cat: 'Room upgrade',  rate: 12.0, mode: 'exclusive', price: null, core: true },
  { id: 'early', cat: 'Early arrival', rate: 12.0, mode: 'exclusive', price: 35,   core: true },
  { id: 'late',  cat: 'Late checkout', rate: 12.0, mode: 'exclusive', price: 40,   core: true },
];
export const INIT_FEES = [
  { id: 'service', name: 'Service fee', basis: '% of sale', amount: 5, taxable: false, on: false },
];
