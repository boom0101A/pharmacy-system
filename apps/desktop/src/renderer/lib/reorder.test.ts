import { describe, expect, it } from 'vitest';
import { suggestedReorderQuantity } from './reorder';

describe('suggestedReorderQuantity', () => {
  it('suggests exactly enough to reach the reorder level', () => {
    expect(suggestedReorderQuantity(10, 3)).toBe(7);
  });

  it('suggests at least 1 even when stock already meets the reorder level', () => {
    expect(suggestedReorderQuantity(10, 10)).toBe(1);
  });

  it('suggests at least 1 even when stock exceeds the reorder level', () => {
    expect(suggestedReorderQuantity(10, 15)).toBe(1);
  });

  it('handles zero stock', () => {
    expect(suggestedReorderQuantity(5, 0)).toBe(5);
  });
});
