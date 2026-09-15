import { describe, expect, it } from 'vitest';
import { batchSchema } from '../batches.routes.js';
import { purchaseSchema } from '../purchases.routes.js';

describe('batchSchema price fields', () => {
  it('rejects Infinity as a purchase price', () => {
    expect(() => batchSchema.parse({ productId: 1, quantity: 5, purchasePrice: Infinity })).toThrow();
  });
});

describe('purchaseSchema price fields', () => {
  it('rejects Infinity as a line item unit price', () => {
    expect(() =>
      purchaseSchema.parse({
        supplierId: 1,
        items: [{ productId: 1, quantity: 5, unitPrice: Infinity }],
      }),
    ).toThrow();
  });
});
