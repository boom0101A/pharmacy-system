// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';

const PAIN = { id: 1, name: 'مسكنات', productCount: 5 };
const ACHES = { id: 2, name: 'آلام', productCount: 3 };
const EMPTY = { id: 3, name: 'فارغ', productCount: 0 };

describe('DeleteCategoryDialog', () => {
  it('asks where the medicines go, defaulting to no category', () => {
    const onConfirm = vi.fn();
    render(<DeleteCategoryDialog category={PAIN} categories={[PAIN, ACHES, EMPTY]} onCancel={() => {}} onConfirm={onConfirm} />);

    expect(screen.getByText(/5 دواء مرتبط بهذا التصنيف/)).toBeTruthy();
    const select = screen.getByLabelText('انقل أدويته إلى') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['بدون تصنيف', 'آلام', 'فارغ']);

    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('hands back the chosen category', () => {
    const onConfirm = vi.fn();
    render(<DeleteCategoryDialog category={PAIN} categories={[PAIN, ACHES]} onCancel={() => {}} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('انقل أدويته إلى'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));

    expect(onConfirm).toHaveBeenCalledWith(ACHES);
  });

  it('skips the question for a category with no medicines', () => {
    render(<DeleteCategoryDialog category={EMPTY} categories={[PAIN, EMPTY]} onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.queryByLabelText('انقل أدويته إلى')).toBeNull();
  });
});
