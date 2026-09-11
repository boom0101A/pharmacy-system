import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import * as Label from '@radix-ui/react-label';
import styles from './Input.module.css';
import { cx } from '../../lib/cx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={styles.field}>
      {label && (
        <Label.Root className={styles.label} htmlFor={inputId}>
          {label}
        </Label.Root>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cx(styles.input, error && styles.invalid, className)}
        {...props}
      />
      {error && (
        <span id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </span>
      )}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  );
});
