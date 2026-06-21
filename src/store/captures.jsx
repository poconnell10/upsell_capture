import { createContext, useContext, useMemo, useCallback } from 'react';
import { useLocalStorage } from '../lib/useLocalStorage';

// Captured sales are shared across the app: the Capture Sale screen writes them,
// and the Agent Sales dashboard reads them back as line items.
const CapturesContext = createContext(null);

export function CapturesProvider({ children }) {
  const [captured, setCaptured] = useLocalStorage('bm_captured', []);

  const addCapture = useCallback((rec) => setCaptured((cs) => [rec, ...cs]), [setCaptured]);
  const voidCapture = useCallback(
    (ref) => setCaptured((cs) => cs.filter((c) => c.ref !== ref)),
    [setCaptured],
  );

  const value = useMemo(
    () => ({ captured, addCapture, voidCapture }),
    [captured, addCapture, voidCapture],
  );

  return <CapturesContext.Provider value={value}>{children}</CapturesContext.Provider>;
}

export function useCaptures() {
  const ctx = useContext(CapturesContext);
  if (!ctx) throw new Error('useCaptures must be used within a CapturesProvider');
  return ctx;
}

// Normalise a captured-sale record into dashboard line items (one row per product).
export function captureToLines(rec) {
  const lines = [];
  if (rec.roomTotal > 0 && rec.up) {
    lines.push({
      id: rec.ref + '-r',
      daysAgo: 0,
      conf: rec.conf,
      agentId: rec.agent,
      agent: rec.agentName || rec.agent,
      product: rec.up + ' upgrade',
      type: 'Room',
      qty: rec.nights,
      unit: rec.perNight,
      amount: rec.roomTotal,
    });
  }
  (rec.extras || []).forEach((e, i) =>
    lines.push({
      id: rec.ref + '-e' + i,
      daysAgo: 0,
      conf: rec.conf,
      agentId: rec.agent,
      agent: rec.agentName || rec.agent,
      product: e.name || '(unnamed)',
      type: 'Other',
      qty: 1,
      unit: e.price || 0,
      amount: e.price || 0,
    }),
  );
  return lines;
}
