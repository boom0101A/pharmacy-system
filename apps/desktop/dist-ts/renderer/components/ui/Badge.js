import { jsx as _jsx } from "react/jsx-runtime";
import styles from './Badge.module.css';
import { cx } from '../../lib/cx';
export function Badge({ tone = 'neutral', pulse, children }) {
    return _jsx("span", { className: cx(styles.badge, styles[tone], pulse && styles.pulse), children: children });
}
