import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs` (for countdowns and "now" indicators). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
