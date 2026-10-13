// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({ api: { productAlternatives: vi.fn() } }));

const { api } = await import('../../lib/api');
const { AlternativesDialog } = await import('./AlternativesDialog');

const productA = { id: 1, name: 'أ' } as never;
const productB = { id: 2, name: 'ب' } as never;

describe('AlternativesDialog', () => {
  it('ignores a late reply for a product that is no longer shown', async () => {
    let resolveA!: (rows: unknown[]) => void;
    vi.mocked(api.productAlternatives)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveA = resolve as never)) as never)
      .mockResolvedValueOnce([{ id: 20, name: 'بديل ب', salePrice: 5, stock: 2 }] as never);

    const { rerender } = render(<AlternativesDialog product={productA} onClose={() => {}} onPick={() => {}} />);
    rerender(<AlternativesDialog product={productB} onClose={() => {}} onPick={() => {}} />);
    await screen.findByText('بديل ب');

    resolveA([{ id: 10, name: 'بديل أ قديم', salePrice: 5, stock: 2 }]);
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByText('بديل أ قديم')).toBeNull();
    expect(screen.getByText('بديل ب')).toBeTruthy();
  });
});
