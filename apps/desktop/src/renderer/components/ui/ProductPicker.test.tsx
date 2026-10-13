// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({ api: { products: vi.fn() } }));

const { api } = await import('../../lib/api');
const { ProductPicker } = await import('./ProductPicker');

describe('ProductPicker', () => {
  it('shows the results of the latest query even when an older, slower query answers last', async () => {
    vi.useFakeTimers();
    let resolveOld!: (rows: unknown[]) => void;
    vi.mocked(api.products)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve as never)) as never)
      .mockResolvedValueOnce([{ id: 2, name: 'باراسيتامول', salePrice: 1, stock: 1 }] as never);

    render(<ProductPicker onSelect={() => {}} />);
    const input = screen.getByPlaceholderText('ابحث عن دواء…');

    fireEvent.change(input, { target: { value: 'ب' } });
    await act(async () => vi.advanceTimersByTimeAsync(250));
    fireEvent.change(input, { target: { value: 'باراسيتامول' } });
    await act(async () => vi.advanceTimersByTimeAsync(250));

    await act(async () => resolveOld([{ id: 1, name: 'بروفين قديم', salePrice: 1, stock: 1 }]));

    expect(screen.queryByText('بروفين قديم')).toBeNull();
    expect(screen.getByText('باراسيتامول')).toBeTruthy();
    vi.useRealTimers();
  });
});
