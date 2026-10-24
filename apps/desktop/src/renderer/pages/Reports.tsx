import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import styles from './Reports.module.css';
import { Input } from '../components/ui/Input';
import { baghdadToday, formatDate, formatMoney } from '../lib/cx';
import { useReportsData } from '../lib/useReportsData.js';
import { profitMargin } from '../lib/profitMargin';
import { useAuth } from '../store/auth';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Tab = 'sales' | 'sold-products' | 'top-products' | 'by-category' | 'expiry' | 'low-stock' | 'write-offs';

const TABS: { key: Tab; label: string }[] = [
  { key: 'sales', label: 'المبيعات' },
  { key: 'sold-products', label: 'الأدوية المباعة' },
  { key: 'top-products', label: 'الأكثر مبيعاً' },
  { key: 'by-category', label: 'حسب التصنيف' },
  { key: 'expiry', label: 'الصلاحية' },
  { key: 'low-stock', label: 'المخزون المنخفض' },
  { key: 'write-offs', label: 'الخسائر' },
];

/** Maps each tab to the report key that feeds it, for the per-tab error banner below. */
const TAB_REPORT_KEY = {
  sales: 'sales',
  'sold-products': 'soldProducts',
  'top-products': 'topProducts',
  'by-category': 'byCategory',
  expiry: 'expiry',
  'low-stock': 'lowStock',
  'write-offs': 'writeOffs',
} as const;

const REPORT_LABEL: Record<string, string> = {
  sales: 'تقرير المبيعات',
  topProducts: 'الأكثر مبيعاً',
  byCategory: 'تقرير التصنيفات',
  expiry: 'تقرير الصلاحية',
  lowStock: 'المخزون المنخفض',
  profit: 'تقرير الأرباح',
  writeOffs: 'سجل الخسائر',
  soldProducts: 'الأدوية المباعة',
  today: 'مبيعات اليوم',
};

/*
 * Recharts paints its own greys (white tooltip, #666 ticks, #ccc grid) that
 * ignore the theme — unreadable in dark mode. Pointing them at the tokens
 * makes the charts follow light/dark like everything else.
 */
const CHART_GRID = { strokeDasharray: '3 3', stroke: 'var(--line-strong)' };
const CHART_AXIS = { stroke: 'var(--line-strong)', tick: { fill: 'var(--text-secondary)', fontSize: 12 } };
const CHART_TOOLTIP = {
  contentStyle: {
    background: 'var(--glass-bg-strong)',
    backdropFilter: 'var(--glass-blur)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--glass-shadow)',
    color: 'var(--text-primary)',
  },
  labelStyle: { color: 'var(--text-secondary)', fontWeight: 700 },
  itemStyle: { color: 'var(--text-primary)' },
  cursor: { fill: 'var(--row-hover)', stroke: 'var(--line-strong)' },
};

export function Reports() {
  const canSeeProfit = useAuth((s) => s.can('admin'));

  const today = baghdadToday();
  const monthAgo = isoDate(new Date(new Date(today).getTime() - 30 * 86_400_000));
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<Tab>('sales');

  const { sales, topProducts, byCategory, expiry, lowStock, profit, writeOffs, soldProducts, today: todaySales, errors } = useReportsData(
    from,
    to,
    canSeeProfit,
  );

  const totalRevenue = sales.reduce((sum, p) => sum + p.total, 0);
  const totalProfit = profit.reduce((sum, p) => sum + p.profit, 0);
  const margin = profitMargin(profit);
  const currentReportKey = TAB_REPORT_KEY[tab];
  const currentError = errors[currentReportKey];

  return (
    <div>
      {tab !== 'write-offs' && (
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
      )}

      {canSeeProfit && errors.profit && (
        <p className={styles.error}>تعذّر تحميل {REPORT_LABEL.profit}: {errors.profit}</p>
      )}
      {errors.today && <p className={styles.error}>تعذّر تحميل {REPORT_LABEL.today}: {errors.today}</p>}
      <div className={styles.summary}>
        <SummaryCard
          label={todaySales ? `مبيعات اليوم (${todaySales.count} فاتورة)` : 'مبيعات اليوم'}
          value={todaySales ? formatMoney(todaySales.total) : '…'}
        />
        <SummaryCard label="مبيعات الفترة" value={formatMoney(totalRevenue)} />
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
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} {...CHART_AXIS} />
              <YAxis {...CHART_AXIS} />
              <Tooltip
                labelFormatter={(d) => formatDate(String(d))}
                formatter={(v) => formatMoney(Number(v))}
                {...CHART_TOOLTIP}
              />
              <Line type="monotone" dataKey="total" stroke="var(--brand-9)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'sales' && sales.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>عدد الفواتير</th>
              <th>المجموع</th>
            </tr>
          </thead>
          <tbody>
            {[...sales].reverse().map((day) => (
              <tr key={day.date}>
                <td>{formatDate(day.date)}</td>
                <td className="numeric">{day.count}</td>
                <td className="numeric">{formatMoney(day.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'sold-products' &&
        (soldProducts.length === 0 ? (
          <p className={styles.empty}>لم يُبع أي دواء في هذه الفترة</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>الصنف</th>
                <th>علب</th>
                <th>وحدات فرعية</th>
                <th>قيمة المبيع</th>
              </tr>
            </thead>
            <tbody>
              {soldProducts.map((p) => (
                <tr key={p.productId}>
                  <td>{p.productName}</td>
                  <td className="numeric">{p.packages}</td>
                  <td className="numeric">{p.subUnits > 0 ? `${p.subUnits} ${p.subUnitName ?? ''}` : '—'}</td>
                  <td className="numeric">{formatMoney(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

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
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="categoryName" {...CHART_AXIS} />
              <YAxis {...CHART_AXIS} />
              <Tooltip formatter={(v) => formatMoney(Number(v))} {...CHART_TOOLTIP} />
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

      {tab === 'write-offs' && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>تاريخ انتهاء الدفعة</th>
              <th>بواسطة</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {writeOffs.map((row) => (
              <tr key={row.id}>
                <td>{row.productName}</td>
                <td className="numeric">{row.quantity}</td>
                <td>{formatDate(row.batchExpiryDate)}</td>
                <td>{row.userName}</td>
                <td>{formatDate(row.createdAt)}</td>
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
