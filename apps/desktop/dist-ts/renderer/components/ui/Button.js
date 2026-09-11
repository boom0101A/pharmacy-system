import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
import styles from './Button.module.css';
import { cx } from '../../lib/cx';
export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', fullWidth, className, type = 'button', ...props }, ref) {
    return (_jsx("button", { ref: ref, type: type, className: cx(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className), ...props }));
});
