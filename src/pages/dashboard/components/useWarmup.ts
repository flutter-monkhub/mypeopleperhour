import { useEffect, useState } from 'react';

// Pages already shown once in this app load skip the skeleton on later visits.
const warmed = new Set<string>();

/**
 * Brief first-mount skeleton (SPEC §4: every data view has a loading state). Data is local, so this
 * only smooths the first paint of heavy pages; returns true once the page should render content.
 */
export function useWarmup(key: string, ms = 380): boolean {
  const [ready, setReady] = useState(() => warmed.has(key));
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => {
      warmed.add(key);
      setReady(true);
    }, ms);
    return () => clearTimeout(t);
  }, [ready, key, ms]);
  return ready;
}
