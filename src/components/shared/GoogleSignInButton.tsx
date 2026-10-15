import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Renders Google's own sign-in button via Google Identity Services.
 *
 * We use Google's rendered button rather than a lookalike because their
 * branding guidelines require it, and because the real button carries the
 * one-tap//FedCM behaviour users expect.
 *
 * The script is loaded once and shared; the client id is public by design,
 * so shipping it in the bundle is safe. All trust decisions happen on the
 * server, which verifies the returned credential against Google's keys.
 */

const SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${SRC}"]`)) return resolve();
    const el = document.createElement('script');
    el.src = SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Could not reach Google'));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export function GoogleSignInButton({
  onCredential,
  disabled,
  text = 'continue_with',
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cbRef   = useRef(onCredential);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback without re-rendering Google's button, which
  // would make it flicker on every parent state change.
  useEffect(() => { cbRef.current = onCredential; }, [onCredential]);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId) {
      setError('Google sign-in is not configured');
      return;
    }
    let cancelled = false;

    loadGsi()
      .then(() => {
        if (cancelled || !hostRef.current) return;
        const google = (window as any).google;
        if (!google?.accounts?.id) throw new Error('Google script loaded but unavailable');

        google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: { credential?: string }) => {
            if (resp?.credential) cbRef.current(resp.credential);
          },
        });

        hostRef.current.innerHTML = '';
        google.accounts.id.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'pill',
          logo_alignment: 'center',
          width: hostRef.current.offsetWidth || 320,
        });
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });

    return () => { cancelled = true; };
  }, [clientId, text]);

  if (error) {
    return (
      <div className='flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200'>
        <AlertCircle className='w-3.5 h-3.5 text-gray-400 shrink-0' />
        <span className='text-xs text-gray-500'>{error}</span>
      </div>
    );
  }

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <div ref={hostRef} className='w-full flex justify-center min-h-[44px]' />
    </div>
  );
}
