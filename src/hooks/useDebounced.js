import { useEffect, useState } from 'react';

/** Debounce a fast-changing value (e.g. store version) before refetching. */
export default function useDebounced(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
