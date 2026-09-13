import { useEffect, useState } from 'react';
import type {
  CategoryRevenuePoint,
  ExpiryReportRow,
  LowStockReportRow,
  ProfitReportPoint,
  SalesReportPoint,
  TopProductPoint,
} from '@pharmacy/shared-types';
import { api } from './api.js';

type ReportKey = 'sales' | 'topProducts' | 'byCategory' | 'expiry' | 'lowStock' | 'profit';

interface ReportsData {
  sales: SalesReportPoint[];
  topProducts: TopProductPoint[];
  byCategory: CategoryRevenuePoint[];
  expiry: ExpiryReportRow[];
  lowStock: LowStockReportRow[];
  profit: ProfitReportPoint[];
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
  errors: {},
};

export function useReportsData(from: string, to: string, canSeeProfit: boolean): ReportsData {
  const [data, setData] = useState<ReportsData>(EMPTY);

  useEffect(() => {
    function load<K extends ReportKey>(key: K, promise: Promise<ReportsData[K]>) {
      promise.then(
        (value) => setData((prev) => ({ ...prev, [key]: value, errors: { ...prev.errors, [key]: undefined } })),
        (err: Error) => setData((prev) => ({ ...prev, errors: { ...prev.errors, [key]: err.message } })),
      );
    }

    load('sales', api.reportSales(from, to));
    load('topProducts', api.reportTopProducts(from, to));
    load('byCategory', api.reportByCategory(from, to));
    // `to` doubles as the expiry cut-off here (see reports.routes.ts) — `from`
    // has no meaning for this report, there is no range to start it from.
    load('expiry', api.reportExpiry(undefined, to));
    load('lowStock', api.reportLowStock());
    if (canSeeProfit) {
      load('profit', api.reportProfit(from, to));
    } else {
      setData((prev) => ({ ...prev, profit: [], errors: { ...prev.errors, profit: undefined } }));
    }
  }, [from, to, canSeeProfit]);

  return data;
}
