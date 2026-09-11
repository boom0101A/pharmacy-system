import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useId } from 'react';
import * as Label from '@radix-ui/react-label';
import styles from './Input.module.css';
import { cx } from '../../lib/cx';
export const Input = forwardRef(function Input({ label, error, hint, className, id, ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (_jsxs("div", { className: styles.field, children: [label && (_jsx(Label.Root, { className: styles.label, htmlFor: inputId, children: label })), _jsx("input", { ref: ref, id: inputId, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${inputId}-error` : undefined, className: cx(styles.input, error && styles.invalid, className), ...props }), error && (_jsx("span", { id: `${inputId}-error`, className: styles.error, role: "alert", children: error })), hint && !error && _jsx("span", { className: styles.hint, children: hint })] }));
});
