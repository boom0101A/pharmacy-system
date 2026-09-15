import type { Product } from '@pharmacy/shared-types';

/**
 * The alternatives list carries only display fields, so picking one still
 * needs the full product record before it can be added to the cart. Checks
 * whatever the POS screen already has loaded first — the common case, no
 * request needed — before asking the server for the whole catalogue.
 */
export async function findAlternativeProduct(
  id: number,
  loadedProducts: Product[],
  fetchAll: () => Promise<Product[]>,
): Promise<Product | undefined> {
  const alreadyLoaded = loadedProducts.find((p) => p.id === id);
  if (alreadyLoaded) return alreadyLoaded;
  const rows = await fetchAll();
  return rows.find((p) => p.id === id);
}
