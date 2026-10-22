import { useCallback, useState } from 'react';

const KEY = 'pharmacy.pos.hideProducts';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Whether the POS hides its product grid (scanner-only tills, wider cart).
 * A per-till preference, so it lives in this machine's localStorage — and a
 * blocked storage only means the choice isn't remembered, never a crash.
 */
export function usePosProductsHidden(): [boolean, () => void] {
  const [hidden, setHidden] = useState(read);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        // Not remembered across restarts; the toggle itself still works.
      }
      return next;
    });
  }, []);

  return [hidden, toggle];
}
