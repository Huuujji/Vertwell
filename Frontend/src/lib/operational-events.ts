export const operationalEvents = ['updates.offline', 'updates.recovered', 'checkout.unconfirmed', 'checkout.reconciled', 'storage.unavailable'] as const;
export type OperationalEvent = typeof operationalEvents[number];

// Only allowlisted state, no identifiers, cart/payment contents, keys or errors.
// Best effort, bounded, and never replayed. Telemetry failure cannot block sales
// or create another business operation.
export function createOperationalReporter(send: (event: OperationalEvent) => Promise<unknown>, now = Date.now) {
  const last = new Map<OperationalEvent, number>();
  return (event: OperationalEvent) => {
    const previous = last.get(event), current = now();
    if (previous !== undefined && current - previous < 60_000) return;
    last.set(event, current);
    void Promise.resolve().then(() => send(event)).catch(() => { /* Optional observation only. */ });
  };
}
