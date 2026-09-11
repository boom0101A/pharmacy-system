import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, Cross, LayoutDashboard, LogOut, Package, ScanBarcode, Settings, ShoppingBag, Truck, Undo2, Users as UsersIcon, } from 'lucide-react';
import styles from './AppShell.module.css';
import { useAuth } from '../store/auth';
import { useBranding } from '../store/branding';
import { cx, formatDate } from '../lib/cx';
const NAV = [
    {
        to: '/pos',
        label: 'نقطة البيع',
        icon: _jsx(ScanBarcode, { size: 18 }),
        roles: ['admin', 'pharmacist', 'cashier'],
    },
    {
        to: '/',
        label: 'لوحة التحكم',
        icon: _jsx(LayoutDashboard, { size: 18 }),
        roles: ['admin', 'pharmacist', 'cashier'],
    },
    {
        to: '/returns',
        label: 'الإرجاعات',
        icon: _jsx(Undo2, { size: 18 }),
        roles: ['admin', 'pharmacist', 'cashier'],
    },
    {
        to: '/inventory',
        label: 'المخزون',
        icon: _jsx(Package, { size: 18 }),
        roles: ['admin', 'pharmacist', 'cashier'],
    },
    {
        to: '/suppliers',
        label: 'الموردون',
        icon: _jsx(Truck, { size: 18 }),
        roles: ['admin', 'pharmacist'],
    },
    {
        to: '/purchases',
        label: 'المشتريات',
        icon: _jsx(ShoppingBag, { size: 18 }),
        roles: ['admin', 'pharmacist'],
    },
    {
        to: '/reports',
        label: 'التقارير',
        icon: _jsx(BarChart3, { size: 18 }),
        roles: ['admin', 'pharmacist'],
    },
    {
        to: '/users',
        label: 'المستخدمون',
        icon: _jsx(UsersIcon, { size: 18 }),
        roles: ['admin'],
    },
    {
        to: '/settings',
        label: 'الإعدادات',
        icon: _jsx(Settings, { size: 18 }),
        roles: ['admin'],
    },
];
const ROLE_LABEL = {
    admin: 'مدير',
    pharmacist: 'صيدلي',
    cashier: 'كاشير',
};
const TITLES = {
    '/': 'لوحة التحكم',
    '/pos': 'نقطة البيع',
    '/returns': 'الإرجاعات',
    '/inventory': 'المخزون',
    '/suppliers': 'الموردون',
    '/purchases': 'المشتريات',
    '/reports': 'التقارير',
    '/users': 'المستخدمون',
    '/settings': 'الإعدادات',
};
export function AppShell() {
    const { user, logout } = useAuth();
    const logoUrl = useBranding((s) => s.logoUrl);
    const { pathname } = useLocation();
    const visible = NAV.filter((entry) => user && entry.roles.includes(user.role));
    /**
     * Arrow keys walk the sidebar, wrapping at both ends. Scoped to the nav
     * itself rather than the window: up/down still belong to whatever is focused
     * everywhere else in the app — the till's search field and number inputs
     * would both break if these keys were claimed globally.
     */
    function handleNavKeys(event) {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
            return;
        const links = Array.from(event.currentTarget.querySelectorAll('a'));
        const current = links.indexOf(document.activeElement);
        if (current === -1)
            return;
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        links[(current + step + links.length) % links.length].focus();
    }
    return (_jsxs("div", { className: styles.shell, children: [_jsxs("aside", { className: styles.sidebar, children: [_jsxs("div", { className: styles.brand, children: [logoUrl ? (_jsx("img", { src: logoUrl, alt: "", className: styles.brandLogo })) : (_jsx("span", { className: styles.brandMark, children: _jsx(Cross, { size: 18 }) })), _jsxs("div", { children: [_jsx("div", { className: styles.brandName, children: "\u0646\u0638\u0627\u0645 \u0627\u0644\u0635\u064A\u062F\u0644\u064A\u0629" }), _jsx("div", { className: styles.brandMeta, children: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A" })] })] }), _jsx("nav", { className: styles.nav, onKeyDown: handleNavKeys, children: visible.map((entry) => (_jsxs(NavLink, { to: entry.to, end: entry.to === '/', className: ({ isActive }) => cx(styles.navItem, isActive && styles.navItemActive), children: [entry.icon, entry.label] }, entry.to))) }), user && (_jsxs("div", { className: styles.userBox, children: [_jsx("span", { className: styles.avatar, children: user.name.charAt(0) }), _jsxs("div", { children: [_jsx("div", { className: styles.userName, children: user.name }), _jsx("div", { className: styles.userRole, children: ROLE_LABEL[user.role] })] }), _jsx("button", { className: styles.logout, onClick: logout, "aria-label": "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C", children: _jsx(LogOut, { size: 16 }) })] }))] }), _jsxs("div", { className: styles.main, children: [_jsxs("header", { className: styles.topbar, children: [_jsx("h1", { className: styles.pageTitle, children: TITLES[pathname] ?? '' }), _jsx("span", { className: styles.topbarDate, children: formatDate(new Date().toISOString()) })] }), _jsx("main", { className: styles.content, children: _jsx(Outlet, {}) }, pathname)] })] }));
}
