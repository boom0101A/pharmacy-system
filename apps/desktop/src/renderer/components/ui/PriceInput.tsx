import type { ChangeEvent } from 'react';
import { Input, type InputProps } from './Input';
import { reformatPriceInput } from '../../lib/priceInput';

interface PriceInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  /** The formatted text ("1,500"); read it back with `parsePriceInput`. */
  value: string;
  onValueChange: (formatted: string) => void;
}

/**
 * Every money field: whole dinars with live thousands separators, Arabic
 * digits accepted. Reformatting on each keystroke would throw the caret to
 * the end whenever a comma shifts, so it is put back once the browser has
 * painted the new value.
 */
export function PriceInput({ value, onValueChange, ...props }: PriceInputProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const cursorPos = input.selectionStart ?? input.value.length;
    const { formatted, cursorPos: newCursorPos } = reformatPriceInput(input.value, cursorPos);
    onValueChange(formatted);
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.setSelectionRange(newCursorPos, newCursorPos);
    });
  }

  return <Input inputMode="numeric" dir="ltr" {...props} value={value} onChange={handleChange} />;
}

/** The initial text for a PriceInput showing a stored amount. */
export function formatPriceInput(amount: number | null | undefined): string {
  return amount === null || amount === undefined ? '' : reformatPriceInput(String(Math.round(amount)), 0).formatted;
}
