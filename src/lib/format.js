// Money & rounding helpers shared by every screen.
export const round5 = (n) => Math.max(0, Math.round(n / 5) * 5);

export const money = (n) => '$' + (n || 0).toLocaleString();

export const money2 = (n) =>
  '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const DLABEL = (d) => (d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d + 'd ago');
