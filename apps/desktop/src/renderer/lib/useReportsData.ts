import { useEffect, useRef, useState } from 'react';
import type {
  CategoryRevenuePoint,
  ExpiryReportRow,
  LowStockReportRow,
  ProfitReportPoint,
  SalesReportPoint,
  SoldProductRow,
  TopProductPoint,
  WriteOffReportRow,
} from '@pharmacy/shared-types';
import { api } from './api.js';
import { baghdadToday } from './cx';

type ReportKey =
  | 'sales'
  | 'topProducts'
  | 'byCategory'
  | 'expiry'
  | 'lowStock'
  | 'profit'
  | 'writeOffs'
  | 'soldProducts'
  | 'today';

interface ReportsData {
  sales: SalesReportPoint[];
  topProducts: TopProductPoint[];
  byCategory: CategoryRevenuePoint[];
  expiry: ExpiryReportRow[];
  lowStock: LowStockReportRow[];
  profit: ProfitReportPoint[];
  writeOffs: WriteOffReportRow[];
  soldProducts: SoldProductRow[];
  /** Always today's totals, whatever range is picked. null until loaded. */
  today: { total: number; count: number } | null;
  /** Only the report(s) that actually failed — every other report keeps showing what it loaded, instead of one generic toast that doesn't say which tab is stale. */
  errors: Partial<Record<ReportKey, string>>;
}

const EMPTY: ReportsData = {
  sales: [],
  topProducts: [],
  byCategory: [],
  expiry: [],
  lowStock: [],
  profit: [],
  writeOffs: [],
  soldProducts: [],
  today: null,
  errors: {},
};

export function useReportsData(
  from: string,
  to: string,
  canSeeProfit: boolean,
  today: string = baghdadToday(),
): ReportsData {
  const [data, setData] = useState<ReportsData>(EMPTY);
  // Bumped every time from/to/canSeeProfit changes, so a response can tell
  // whether it still belongs to the latest request — changing the date range
  // twice in quick succession must not let whichever request happens to
  // finish last (not necessarily the newest one) overwrite fresher data.
  const requestId = useRef(0);

  useEffect(() => {
    const thisRequestId = ++requestId.current;

    function load<K extends ReportKey>(key: K, promise: Promise<ReportsData[K]>) {
      promise.then(
        (value) => {
          if (requestId.current !== thisRequestId) return;
          setData((prev) => ({ ...prev, [key]: value, errors: { ...prev.errors, [key]: undefined } }));
        },
        (err: Error) => {
          if (requestId.current !== thisRequestId) return;
          setData((prev) => ({ ...prev, errors: { ...prev.errors, [key]: err.message } }));
        },
      );
    }

    load('sales', api.reportSales(from, to));
    load('topProducts', api.reportTopProducts(from, to));
    load('byCategory', api.reportByCategory(from, to));
    // `to` doubles as the expiry cut-off here (see reports.routes.ts) — `from`
    // has no meaning for this report, there is no range to start it from.
    load('expiry', api.reportExpiry(undefined, to));
    load('lowStock', api.reportLowStock());
    load('writeOffs', api.reportWriteOffs());
    load('soldProducts', api.reportSoldProducts(from, to));
    if (canSeeProfit) {
      load('profit', api.reportProfit(from, to));
    } else {
      setData((prev) => ({ ...prev, profit: [], errors: { ...prev.errors, profit: undefined } }));
    }
  }, [from, to, canSeeProfit]);

  // Its own effect: changing the range must not refetch (or flicker) today's card.
  useEffect(() => {
    let current = true;
    api.reportSales(today, today).then(
      (points) => {
        if (!current) return;
        const total = points.reduce((sum, p) => sum + p.total, 0);
        const count = points.reduce((sum, p) => sum + p.count, 0);
        setData((prev) => ({ ...prev, today: { total, count }, errors: { ...prev.errors, today: undefined } }));
      },
      (err: Error) => current && setData((prev) => ({ ...prev, errors: { ...prev.errors, today: err.message } })),
    );
    return () => {
      current = false;
    };
  }, [today]);

  return data;
}
