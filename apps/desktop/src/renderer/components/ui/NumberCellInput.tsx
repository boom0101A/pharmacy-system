import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { normalizeDigits, reformatPriceInput } from '../../lib/priceInput';
import { formatMoney } from '../../lib/cx';

interface NumberCellInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min'> {
  value: number;
  min: number;
  onCommit: (value: number) => void;
  /** Whole dinars with thousands separators, like every other money field. */
  money?: boolean;
}

/**
 * A plain `<input type="number" value={n} onChange={... Number(e.target.value) || fallback}>`
 * snaps back to `fallback` the instant the field is cleared — `Number('')`
 * is `0`, which is falsy, so clearing the field to retype a new value keeps
 * fighting back to the old fallback instead of ever going empty. This keeps
 * a free-typed draft and only resolves it to a committed number on blur,
 * reverting to the last valid value if what's left is empty or below `min`.
 */
export function NumberCellInput({ value, min, onCommit, money = false, ...inputProps }: NumberCellInputProps) {
  const show = (n: number) => (money ? formatMoney(n) : String(n));
  const [text, setText] = useState(show(value));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setText(show(value)), [value, money]);

  function commit() {
    const parsed = Number(normalizeDigits(text).replace(/[,\s]/g, ''));
    if (text !== '' && Number.isFinite(parsed) && parsed >= min) {
      onCommit(parsed);
    } else {
      setText(show(value));
    }
  }

  return (
    <input
      {...inputProps}
      inputMode={money ? 'numeric' : 'decimal'}
      dir={money ? 'ltr' : inputProps.dir}
      value={text}
      onChange={(e) => setText(money ? reformatPriceInput(e.target.value, e.target.value.length).formatted : e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
