import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Cross,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShoppingBag,
  Truck,
  Undo2,
  Users as UsersIcon,
} from 'lucide-react';
import styles from './AppShell.module.css';
import { useAuth } from '../store/auth';
import { useBranding } from '../store/branding';
import { cx } from '../lib/cx';
import { Clock } from './Clock';
import { ShortcutsButton } from './ShortcutsDialog';
import { ThemeToggle } from './ThemeToggle';
import type { Role } from '@pharmacy/shared-types';

interface NavEntry {
  to: string;
  label: string;
  icon: ReactNode;
  /** Roles allowed to see the link; the server enforces the same rules. */
  roles: Role[];
}

const NAV: NavEntry[] = [
  {
    to: '/pos',
    label: 'نقطة البيع',
    icon: <ScanBarcode size={18} />,
    roles: ['admin', 'pharmacist', 'cashier'],
  },
  {
    to: '/',
    label: 'لوحة التحكم',
    icon: <LayoutDashboard size={18} />,
    roles: ['admin', 'pharmacist', 'cashier'],
  },
  {
    to: '/returns',
    label: 'الإرجاعات',
    icon: <Undo2 size={18} />,
    roles: ['admin', 'pharmacist', 'cashier'],
  },
  {
    to: '/history',
    label: 'سجل الفواتير',
    icon: <ReceiptText size={18} />,
    // Same as the reports: the cashier is kept away from sales totals.
    roles: ['admin', 'pharmacist'],
  },
  {
    to: '/inventory',
    label: 'المخزون',
    icon: <Package size={18} />,
    roles: ['admin', 'pharmacist', 'cashier'],
  },
  {
    to: '/suppliers',
    label: 'الموردون',
    icon: <Truck size={18} />,
    roles: ['admin', 'pharmacist'],
  },
  {
    to: '/purchases',
    label: 'المشتريات',
    icon: <ShoppingBag size={18} />,
    roles: ['admin', 'pharmacist'],
  },
  {
    to: '/reports',
    label: 'التقارير',
    icon: <BarChart3 size={18} />,
    roles: ['admin', 'pharmacist'],
  },
  {
    to: '/users',
    label: 'المستخدمون',
    icon: <UsersIcon size={18} />,
    roles: ['admin'],
  },
  {
    to: '/settings',
    label: 'الإعدادات',
    icon: <Settings size={18} />,
    roles: ['admin'],
  },
];

const ROLE_LABEL: Record<Role, string> = {
  admin: 'مدير',
  pharmacist: 'صيدلي',
  cashier: 'كاشير',
};

export function AppShell() {
  const { user, logout } = useAuth();
  const logoUrl = useBranding((s) => s.logoUrl);
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  const visible = NAV.filter((entry) => user && entry.roles.includes(user.role));
  // The page's title and icon come from the sidebar entry itself. A separate
  // title map had already drifted once: "سجل الفواتير" was added to the
  // sidebar but not to the map, and showed an empty title.
  const current = NAV.find((entry) => entry.to === pathname);

  /**
   * The active-item highlight used to just vanish from the old link and
   * reappear on the new one — correct but not smooth. Measuring the active
   * link's own box and sliding one shared indicator there (instead of each
   * item painting its own background) is what makes it glide between them.
   * useLayoutEffect, not useEffect: it runs before the browser paints, so the
   * very first render already lands the indicator in the right place with no
   * visible jump from position (0,0).
   */
  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    const active = nav.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!active) return;
    indicator.style.transform = `translateY(${active.offsetTop}px)`;
    indicator.style.height = `${active.offsetHeight}px`;
  }, [pathname]);

  /**
   * Arrow keys walk the sidebar, wrapping at both ends. Scoped to the nav
   * itself rather than the window: up/down still belong to whatever is focused
   * everywhere else in the app — the till's search field and number inputs
   * would both break if these keys were claimed globally.
   */
  function handleNavKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const links = Array.from(event.currentTarget.querySelectorAll('a'));
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (current === -1) return;

    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    links[(current + step + links.length) % links.length].focus();
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className={styles.brandLogo} />
          ) : (
            <span className={styles.brandMark}>
              <Cross size={18} />
            </span>
          )}
          <div>
            <div className={styles.brandName}>نظام الصيدلية</div>
            <div className={styles.brandMeta}>إدارة المخزون والمبيعات</div>
          </div>
        </div>

        <nav className={styles.nav} onKeyDown={handleNavKeys} ref={navRef}>
          <div className={styles.navIndicator} ref={indicatorRef} aria-hidden="true" />
          {visible.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.to === '/'}
              className={({ isActive }) =>
                cx(styles.navItem, isActive && styles.navItemActive)
              }
            >
              {entry.icon}
              {entry.label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className={styles.userBox}>
            <span className={styles.avatar}>{user.name.charAt(0)}</span>
            <div>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userRole}>{ROLE_LABEL[user.role]}</div>
            </div>
            <button className={styles.logout} onClick={logout} aria-label="تسجيل الخروج">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <h1 key={pathname} className={styles.pageTitle}>
            {current && <span className={styles.pageTitleIcon} aria-hidden="true">{current.icon}</span>}
            {current?.label ?? ''}
          </h1>
          <div className={styles.topbarTools}>
            <ShortcutsButton />
            <ThemeToggle />
            <Clock />
          </div>
        </header>
        {/* Keyed by route so the fade replays on navigation. Keying the <main>
            itself rather than an inner wrapper keeps pages that size themselves
            against it (POS, inventory) with the same parent box they had. */}
        <main key={pathname} className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
