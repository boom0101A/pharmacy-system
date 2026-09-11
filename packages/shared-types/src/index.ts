export type Role = 'admin' | 'pharmacist' | 'cashier';

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface UserInput {
  name: string;
  username: string;
  password?: string;
  role: Role;
  isActive?: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Category {
  id: number;
  name: string;
  /** How many products point at this category; only the list endpoint sets it. */
  productCount?: number;
}

export interface Product {
  id: number;
  name: string;
  barcode: string | null;
  categoryId: number | null;
  categoryName: string | null;
  unit: string;
  salePrice: number;
  purchasePrice: number;
  reorderLevel: number;
  /** Never stored directly — always the live sum of this product's batches. */
  stock: number;
  imageFilename: string | null;
  nearestExpiry: string | null;
  unitsPerPackage: number | null;
  subUnitName: string | null;
  subUnitPrice: number | null;
  activeIngredient: string | null;
  dosageForm: string | null;
  strength: string | null;
  isActive: boolean;
}

export interface ProductInput {
  name: string;
  barcode?: string | null;
  categoryId?: number | null;
  unit: string;
  salePrice: number;
  purchasePrice: number;
  reorderLevel: number;
  unitsPerPackage?: number | null;
  subUnitName?: string | null;
  subUnitPrice?: number | null;
  activeIngredient?: string | null;
  dosageForm?: string | null;
  strength?: string | null;
}

export interface ProductAlternative {
  id: number;
  name: string;
  salePrice: number;
  stock: number;
  unit: string;
}

export interface Batch {
  id: number;
  productId: number;
  batchNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  purchasePrice: number;
  receivedAt: string;
  openedSubUnits: number;
}

export interface BatchInput {
  productId: number;
  quantity: number;
  expiryDate?: string | null;
  batchNumber?: string | null;
  purchasePrice?: number;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
}

export interface SupplierInput {
  name: string;
  phone?: string | null;
  address?: string | null;
}

export type PurchaseStatus = 'pending' | 'received';

export interface PurchaseLineInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
}

export interface PurchaseInput {
  supplierId: number;
  items: PurchaseLineInput[];
}

export interface PurchaseItem {
  id: number;
  purchaseId: number;
  productId: number;
  productName: string;
  batchId: number | null;
  quantity: number;
  unitPrice: number;
  batchNumber: string | null;
  expiryDate: string | null;
}

export interface Purchase {
  id: number;
  supplierId: number;
  supplierName: string;
  userId: number;
  userName: string;
  date: string;
  total: number;
  status: PurchaseStatus;
  items: PurchaseItem[];
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  batchId: number | null;
  quantity: number;
  unitPrice: number;
  isSubUnit: boolean;
}

export interface Sale {
  id: number;
  userId: number;
  date: string;
  total: number;
  discount: number;
  items: SaleItem[];
}

/** A row in the admin/pharmacist "browse sales by date" list (GET /sales) — a Sale with the cashier's name attached. */
export interface SaleListItem extends Sale {
  userName: string;
}

/** One line the cashier rang up; the server resolves which batches to draw from. */
export interface SaleLineInput {
  productId: number;
  quantity: number;
  /** true = `quantity` counts sub-units (e.g. شريط) rather than whole packages. */
  isSubUnit?: boolean;
}

export interface SaleInput {
  items: SaleLineInput[];
  discount?: number;
  /**
   * Stable across retries of the same checkout. Replaying it returns the
   * invoice that was already created rather than creating a second one.
   */
  idempotencyKey?: string;
}

export interface SaleItemDetail extends SaleItem {
  productName: string;
  returnedQuantity: number;
  /**
   * Ready-to-print unit for this line: the sub-unit name when `isSubUnit`,
   * otherwise the product's package unit. Resolved server-side because the
   * sale endpoints are the only place that knows which of the two applies —
   * without it a "4 شريط" line and a "4 علبة" line of the same product are
   * indistinguishable on the returns screen.
   */
  unitLabel: string;
}

export interface SaleDetail {
  id: number;
  userId: number;
  userName?: string;
  date: string;
  total: number;
  discount: number;
  items: SaleItemDetail[];
}

export interface ReturnItem {
  id: number;
  returnId: number;
  saleItemId: number;
  quantity: number;
  unitPrice: number;
  isSubUnit: boolean;
}

export interface Return {
  id: number;
  saleId: number;
  userId: number;
  userName: string;
  date: string;
  total: number;
  reason: string | null;
  items: ReturnItem[];
}

export interface ReturnLineInput {
  saleItemId: number;
  quantity: number;
}

export interface ReturnInput {
  saleId: number;
  items: ReturnLineInput[];
  reason?: string | null;
}

export interface DashboardListItem {
  id: number;
  name: string;
  /** For a low-stock row: current stock. For an expiring row: days remaining. */
  value: number;
}

export interface DashboardSummary {
  todaySalesTotal: number;
  todaySalesCount: number;
  lowStockCount: number;
  expiringSoonCount: number;
  /** The six most urgent of each — the dashboard shows no more than that. */
  lowStock: DashboardListItem[];
  expiringSoon: DashboardListItem[];
}

export interface SalesReportPoint {
  date: string;
  total: number;
  count: number;
}

export interface TopProductPoint {
  productId: number;
  productName: string;
  quantity: number;
  revenue: number;
}

export interface ProfitReportPoint {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface CategoryRevenuePoint {
  categoryName: string;
  revenue: number;
}

export interface ExpiryReportRow {
  productId: number;
  productName: string;
  batchId: number;
  batchNumber: string | null;
  expiryDate: string;
  quantity: number;
}

export interface LowStockReportRow {
  productId: number;
  productName: string;
  stock: number;
  reorderLevel: number;
}

export interface ReceiptLine {
  productName: string;
  quantity: number;
  unitPrice: number;
  unitLabel: string;
}

/** What the desktop hands to the main process to print — already fully resolved, so the print step itself never has to ask the server anything. */
export interface ReceiptData {
  saleId: number;
  date: string;
  cashierName: string;
  items: ReceiptLine[];
  discount: number;
  total: number;
  /** A trial print from Settings, not a real sale — the footer says so instead of an invoice number. */
  isTest?: boolean;
}

export interface BackupFile {
  name: string;
  createdAt: string;
  sizeBytes: number;
}

/** `updatedAt` is also a cache-busting version: it changes only when the logo file itself does. */
export interface BrandingInfo {
  hasLogo: boolean;
  updatedAt: string | null;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
