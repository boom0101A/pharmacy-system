import { useEffect, useRef, useState } from 'react';
import type { Product } from '@pharmacy/shared-types';
import styles from './ProductPicker.module.css';
import { Input } from './Input';
import { api } from '../../lib/api';
import { cx } from '../../lib/cx';

interface ProductPickerProps {
  onSelect: (product: Product) => void;
  placeholder?: string;
}

/** A type-ahead product search — used wherever a line item needs a product (purchase invoices, batch receiving) without leaving the form to look one up. */
export function ProductPicker({ onSelect, placeholder = 'ابحث عن دواء…' }: ProductPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    // An older query that answers last must not overwrite the newer results.
    let current = true;
    const timer = setTimeout(() => {
      api
        .products(query.trim(), { limit: 20 })
        .then((rows) => {
          if (!current) return;
          setResults(rows);
          setOpen(true);
          setActiveIndex(null);
        })
        .catch(() => current && setResults([]));
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  function select(product: Product) {
    onSelect(product);
    setQuery('');
    setResults([]);
    setOpen(false);
    setActiveIndex(null);
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (results.length === 0) return;
      event.preventDefault();
      setActiveIndex((current) => {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const base = current === null ? (step === 1 ? -1 : 0) : current;
        return ((base + step) % results.length + results.length) % results.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = activeIndex !== null ? results[activeIndex] : results.length === 1 ? results[0] : null;
      if (chosen) select(chosen);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <Input
        ref={inputRef}
        aria-label={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && results.length > 0 && (
        <ul className={styles.list} role="listbox">
          {results.map((product, index) => (
            <li key={product.id}>
              <button
                type="button"
                className={cx(styles.item, index === activeIndex && styles.itemActive)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(product)}
              >
                <span>{product.name}</span>
                <span className={cx(styles.stock, 'numeric')}>{product.stock}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
