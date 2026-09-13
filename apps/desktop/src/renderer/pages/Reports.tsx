import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import styles from './Reports.module.css';
import { Input } from '../components/ui/Input';
import { baghdadToday, formatDate, formatMoney } from '../lib/cx';
import { useReportsData } from '../lib/useReportsData.js';
import { useAuth } from '../store/auth';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Tab = 'sales' | 'top-products' | 'by-category' | 'expiry' | 'low-stock';

const TABS: { key: Tab; label: string }[] = [
  { key: 'sales', label: 'المبيعات' },
  { key: 'top-products', label: 'الأكثر مبيعاً' },
  { key: 'by-category', label: 'حسب التصنيف' },
  { key: 'expiry', label: 'الصلاحية' },
  { key: 'low-stock', label: 'المخزون المنخفض' },
];

/** Maps each tab to the report key that feeds it, for the per-tab error banner below. */
const TAB_REPORT_KEY = {
  sales: 'sales',
  'top-products': 'topProducts',
  'by-category': 'byCategory',
  expiry: 'expiry',
  'low-stock': 'lowStock',
} as const;

const REPORT_LABEL: Record<string, string> = {
  sales: 'تقرير المبيعات',
  topProducts: 'الأكثر مبيعاً',
  byCategory: 'تقرير التصنيفات',
  expiry: 'تقرير الصلاحية',
  lowStock: 'المخزون المنخفض',
  profit: 'تقرير الأرباح',
};

export function Reports() {
  const canSeeProfit = useAuth((s) => s.can('admin'));

  const today = baghdadToday();
  const monthAgo = isoDate(new Date(new Date(today).getTime() - 30 * 86_400_000));
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<Tab>('sales');

  const { sales, topProducts, byCategory, expiry, lowStock, profit, errors } = useReportsData(
    from,
    to,
    canSeeProfit,
  );

  const totalRevenue = sales.reduce((sum, p) => sum + p.total, 0);
  const totalProfit = profit.reduce((sum, p) => sum + p.profit, 0);
  const margin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
  const currentReportKey = TAB_REPORT_KEY[tab];
  const currentError = errors[currentReportKey];

  return (
    <div>
      <div className={styles.filters}>
        {tab !== 'expiry' && (
          <Input label="من" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        )}
        <Input
          label={tab === 'expiry' ? 'حتى تاريخ' : 'إلى'}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          hint={tab === 'expiry' ? 'الدفعات المنتهية حتى هذا التاريخ' : undefined}
        />
      </div>

      {canSeeProfit && errors.profit && (
        <p className={styles.error}>تعذّر تحميل {REPORT_LABEL.profit}: {errors.profit}</p>
      )}
      <div className={styles.summary}>
        <SummaryCard label="إجمالي المبيعات" value={formatMoney(totalRevenue)} />
        {canSeeProfit && <SummaryCard label="صافي الربح" value={formatMoney(totalProfit)} />}
        {canSeeProfit && <SummaryCard label="هامش الربح" value={`${margin}%`} />}
      </div>

      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            className={t.key === tab ? styles.tabActive : styles.tab}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {currentError && (
        <p className={styles.error}>
          تعذّر تحميل {REPORT_LABEL[currentReportKey]}: {currentError}
        </p>
      )}

      {tab === 'sales' && (
        <div className={styles.chartCard}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={sales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} />
              <YAxis />
              <Tooltip labelFormatter={(d) => formatDate(String(d))} formatter={(v) => formatMoney(Number(v))} />
              <Line type="monotone" dataKey="total" stroke="var(--brand-9)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'top-products' && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية المباعة</th>
              <th>الإيراد</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p) => (
              <tr key={p.productId}>
                <td>{p.productName}</td>
                <td className="numeric">{p.quantity}</td>
                <td className="numeric">{formatMoney(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'by-category' && (
        <div className={styles.chartCard}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="categoryName" />
              <YAxis />
              <Tooltip formatter={(v) => formatMoney(Number(v))} />
              <Bar dataKey="revenue" fill="var(--accent-9)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'expiry' && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>رقم الدفعة</th>
              <th>تاريخ الانتهاء</th>
              <th>الكمية</th>
            </tr>
          </thead>
          <tbody>
            {expiry.map((row) => (
              <tr key={row.batchId}>
                <td>{row.productName}</td>
                <td>{row.batchNumber ?? '—'}</td>
                <td>{formatDate(row.expiryDate)}</td>
                <td className="numeric">{row.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'low-stock' && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>المتوفر</th>
              <th>حد إعادة الطلب</th>
            </tr>
          </thead>
          <tbody>
            {lowStock.map((row) => (
              <tr key={row.productId}>
                <td>{row.productName}</td>
                <td className="numeric">{row.stock}</td>
                <td className="numeric">{row.reorderLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.summaryCard}>
      <div className={`${styles.summaryValue} numeric`}>{value}</div>
      <div className={styles.summaryLabel}>{label}</div>
    </div>
  );
}
