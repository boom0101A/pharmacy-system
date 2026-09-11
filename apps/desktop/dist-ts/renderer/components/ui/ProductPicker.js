import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import styles from './ProductPicker.module.css';
import { Input } from './Input';
import { api } from '../../lib/api';
import { cx } from '../../lib/cx';
/** A type-ahead product search — used wherever a line item needs a product (purchase invoices, batch receiving) without leaving the form to look one up. */
export function ProductPicker({ onSelect, placeholder = 'ابحث عن دواء…' }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(null);
    const inputRef = useRef(null);
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }
        const timer = setTimeout(() => {
            api
                .products(query.trim(), { limit: 20 })
                .then((rows) => {
                setResults(rows);
                setOpen(true);
                setActiveIndex(null);
            })
                .catch(() => setResults([]));
        }, 200);
        return () => clearTimeout(timer);
    }, [query]);
    function select(product) {
        onSelect(product);
        setQuery('');
        setResults([]);
        setOpen(false);
        setActiveIndex(null);
        inputRef.current?.focus();
    }
    function onKeyDown(event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (results.length === 0)
                return;
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
            if (chosen)
                select(chosen);
            return;
        }
        if (event.key === 'Escape') {
            setOpen(false);
        }
    }
    return (_jsxs("div", { className: styles.wrap, children: [_jsx(Input, { ref: inputRef, value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: onKeyDown, onFocus: () => results.length > 0 && setOpen(true), onBlur: () => setTimeout(() => setOpen(false), 150), placeholder: placeholder }), open && results.length > 0 && (_jsx("ul", { className: styles.list, role: "listbox", children: results.map((product, index) => (_jsx("li", { children: _jsxs("button", { type: "button", className: cx(styles.item, index === activeIndex && styles.itemActive), onMouseDown: (e) => e.preventDefault(), onClick: () => select(product), children: [_jsx("span", { children: product.name }), _jsx("span", { className: cx(styles.stock, 'numeric'), children: product.stock })] }) }, product.id))) }))] }));
}
