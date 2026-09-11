import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/cx';
import styles from './AlternativesDialog.module.css';
/** A dead end turned into a question worth asking: what else has the same active ingredient and is actually in stock. */
export function AlternativesDialog({ product, onClose, onPick }) {
    const [alternatives, setAlternatives] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!product)
            return;
        setLoading(true);
        api
            .productAlternatives(product.id)
            .then(setAlternatives)
            .catch(() => setAlternatives([]))
            .finally(() => setLoading(false));
    }, [product]);
    return (_jsx(Dialog, { open: product !== null, onOpenChange: (open) => !open && onClose(), title: product ? `بدائل "${product.name}"` : '', description: "\u0623\u062F\u0648\u064A\u0629 \u0623\u062E\u0631\u0649 \u0628\u0646\u0641\u0633 \u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0641\u0639\u0651\u0627\u0644\u0629 \u0648\u0645\u062A\u0648\u0641\u0631\u0629 \u062D\u0627\u0644\u064A\u0627\u064B", footer: _jsx(Button, { variant: "ghost", onClick: onClose, children: "\u0625\u063A\u0644\u0627\u0642" }), children: loading ? (_jsxs("div", { className: styles.list, children: [_jsx(Skeleton, { height: "3rem", radius: "var(--radius-md)" }), _jsx(Skeleton, { height: "3rem", radius: "var(--radius-md)" })] })) : alternatives.length === 0 ? (_jsx("p", { className: styles.empty, children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u062F\u0627\u0626\u0644 \u0645\u062A\u0648\u0641\u0631\u0629 \u062D\u0627\u0644\u064A\u0627\u064B" })) : (_jsx("div", { className: styles.list, children: alternatives.map((alt) => (_jsxs("button", { type: "button", className: styles.item, onClick: () => onPick(alt.id), children: [_jsx("span", { children: alt.name }), _jsxs("span", { className: styles.meta, children: [_jsx("span", { className: "numeric", children: formatMoney(alt.salePrice) }), _jsxs("span", { className: "numeric", children: [alt.stock, " ", alt.unit] })] })] }, alt.id))) })) }));
}
