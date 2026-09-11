import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import styles from './Skeleton.module.css';
export function Skeleton({ width = '100%', height = '1rem', radius = 'var(--radius-sm)' }) {
    return _jsx("span", { className: styles.skeleton, style: { width, height, borderRadius: radius } });
}
/** A placeholder table body — same row/column shape as the real table so the layout doesn't jump once data arrives. */
export function SkeletonRows({ rows, columns }) {
    return (_jsx(_Fragment, { children: Array.from({ length: rows }, (_, r) => (_jsx("tr", { children: Array.from({ length: columns }, (_, c) => (_jsx("td", { children: _jsx(Skeleton, { height: "1.25rem" }) }, c))) }, r))) }));
}
