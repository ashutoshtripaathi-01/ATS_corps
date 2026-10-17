import { useEffect, useState } from 'react';
import { getPublicConfig } from '@/lib/api';

interface PaymentsState {
  /** True only once the server has confirmed payments are live. */
  enabled: boolean;
  /** True until the first config response (or failure) arrives. */
  loading: boolean;
}

/**
 * Whether the Razorpay flow is live, read from the server so every component
 * derives from the same one flag — no UI hardcodes its own copy of the
 * answer. If payments are ever switched back on via PAYMENTS_ENABLED on the
 * server, every caller picks it up on next load with no code change here.
 *
 * `loading` matters: naively defaulting `enabled` to false would be correct
 * almost all of the time right now, but it would also make a guard (like the
 * one on the payment page) briefly bounce a legitimate user the one time
 * payments really are on, before the config call resolves. Callers that act
 * on the value — redirecting, gating a route — must wait out `loading`;
 * callers that only choose copy or a CTA label can treat the free default as
 * fine to show for that one frame.
 */
export function usePaymentsEnabledState(): PaymentsState {
  const [state, setState] = useState<PaymentsState>({ enabled: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    getPublicConfig()
      .then((cfg) => { if (!cancelled) setState({ enabled: !!cfg.paymentsEnabled, loading: false }); })
      .catch(() => { if (!cancelled) setState({ enabled: false, loading: false }); });
    return () => { cancelled = true; };
  }, []);

  return state;
}

/** Convenience wrapper for copy/CTA decisions that don't need to wait on load. */
export function usePaymentsEnabled(): boolean {
  return usePaymentsEnabledState().enabled;
}
