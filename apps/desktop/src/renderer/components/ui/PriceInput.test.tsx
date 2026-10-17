// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriceInput } from './PriceInput';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <PriceInput label="السعر" value={value} onValueChange={setValue} />;
}

describe('PriceInput', () => {
  it.each([
    ['9000', '9,000'],
    ['٨٠٠٠', '8,000'],
    ['1250000', '1,250,000'],
  ])('shows %s as %s while typing', (typed, shown) => {
    render(<Harness />);
    const input = screen.getByLabelText('السعر') as HTMLInputElement;

    fireEvent.change(input, { target: { value: typed } });

    expect(input.value).toBe(shown);
  });
});
