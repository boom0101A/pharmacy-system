import { useEffect, useState, type InputHTMLAttributes } from 'react';

interface NumberCellInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min'> {
  value: number;
  min: number;
  onCommit: (value: number) => void;
}

/**
 * A plain `<input type="number" value={n} onChange={... Number(e.target.value) || fallback}>`
 * snaps back to `fallback` the instant the field is cleared — `Number('')`
 * is `0`, which is falsy, so clearing the field to retype a new value keeps
 * fighting back to the old fallback instead of ever going empty. This keeps
 * a free-typed draft and only resolves it to a committed number on blur,
 * reverting to the last valid value if what's left is empty or below `min`.
 */
export function NumberCellInput({ value, min, onCommit, ...inputProps }: NumberCellInputProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => setText(String(value)), [value]);

  function commit() {
    const parsed = Number(text);
    if (text !== '' && Number.isFinite(parsed) && parsed >= min) {
      onCommit(parsed);
    } else {
      setText(String(value));
    }
  }

  return (
    <input
      {...inputProps}
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
