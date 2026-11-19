import { useCallback, useEffect, useState } from 'react';

const TOAST_DURATION_MS = 3500;

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [message]);

  const show = useCallback((next: string) => setMessage(next), []);
  return { message, show };
}

export type ShowToast = (message: string) => void;
