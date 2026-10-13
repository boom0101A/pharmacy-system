import type { Product } from '@pharmacy/shared-types';

/**
 * The alternatives list carries only display fields, so picking one still
 * needs the full product record before it can be added to the cart. Checks
 * whatever the POS screen already has loaded first — the common case, no
 * request needed — and otherwise asks for that one product by id. Searching
 * a page of the catalogue instead missed anything past the server's 100-row cap.
 */
export async function findAlternativeProduct(
  id: number,
  loadedProducts: Product[],
  fetchOne: (id: number) => Promise<Product | null>,
): Promise<Product | null> {
  const alreadyLoaded = loadedProducts.find((p) => p.id === id);
  if (alreadyLoaded) return alreadyLoaded;
  return fetchOne(id);
}

/**
 * The phone-capture poll must wait for a *new* photo: a product that already
 * had one used to close the QR panel on the first poll, before the phone had
 * uploaded anything.
 */
export function newCaptureFilename(initial: string | null, current: string | null): string | null {
  return current && current !== initial ? current : null;
}
