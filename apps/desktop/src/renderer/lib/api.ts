import type {
  BackupFile,
  Batch,
  BatchInput,
  BrandingInfo,
  Category,
  CategoryRevenuePoint,
  DashboardSummary,
  ExpiryReportRow,
  LowStockReportRow,
  WriteOffReportRow,
  LoginResponse,
  Product,
  ProductAlternative,
  ProductInput,
  ProfitReportPoint,
  Purchase,
  PurchaseInput,
  Return,
  ReturnInput,
  Sale,
  SaleDetail,
  SaleInput,
  SaleListItem,
  SalesReportPoint,
  Supplier,
  SupplierInput,
  TopProductPoint,
  User,
  UserInput,
} from '@pharmacy/shared-types';

/**
 * The server address. On the till machines this points at the LAN IP of the
 * machine running the server (e.g. http://192.168.1.10:3000), which the user
 * sets once in Settings; it is kept in localStorage so it survives restarts.
 */
import { serverModeForUrl } from './serverMode.js';

const SERVER_KEY = 'pharmacy.serverUrl';
const TOKEN_KEY = 'pharmacy.token';

export function getServerUrl(): string {
  return localStorage.getItem(SERVER_KEY) ?? 'http://localhost:3000';
}

export function setServerUrl(url: string) {
  const clean = url.replace(/\/$/, '');
  localStorage.setItem(SERVER_KEY, clean);
  // The main process decides whether to start the bundled database from this,
  // and it cannot read localStorage — so the choice is mirrored into settings
  // the moment it is made, not on the next launch.
  void window.pharmacy?.setSettings({ serverMode: serverModeForUrl(clean) }).catch(() => {});
  window.dispatchEvent(new CustomEvent(SERVER_URL_CHANGED_EVENT));
}

/** Fired by `setServerUrl` — long-lived connections (the stock socket) reconnect to the new address. */
export const SERVER_URL_CHANGED_EVENT = 'pharmacy:server-url-changed';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Registered once by the auth store so a 401 on an authenticated request can
 * trigger a clean logout instead of leaving the app stuck on a broken screen.
 * A callback (not a direct import of the store) avoids a circular import,
 * since the auth store already imports from this file.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/**
 * Registered by the connection store, for the same circular-import reason.
 * Called after every request: reaching the server at all counts as online,
 * even when it answers with an error status.
 */
let onConnectionResult: ((online: boolean) => void) | null = null;

export function setConnectionResultHandler(handler: (online: boolean) => void) {
  onConnectionResult = handler;
}

/**
 * A cable pulled mid-request (as opposed to an immediate connection refusal)
 * doesn't reject on its own — plain `fetch` with no signal just hangs. That
 * used to leave a checkout stuck on "جارٍ التنفيذ…" forever, with the sale
 * never recorded and no error shown, recoverable only by restarting the app.
 */
const REQUEST_TIMEOUT_MS = 15000;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${getServerUrl()}/api${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    onConnectionResult?.(false);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'انتهت مهلة الاتصال بالخادم — تحقّق من الشبكة');
    }
    throw new ApiError(0, 'تعذّر الاتصال بالخادم — تحقّق من الشبكة أو عنوان الخادم');
  } finally {
    clearTimeout(timeout);
  }

  onConnectionResult?.(true);
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // A bare 401 from /auth/login (no token sent) just means wrong
    // credentials — only an *authenticated* request going stale should log
    // the whole app out from under whoever is mid-task.
    if (res.status === 401 && token) {
      onUnauthorized?.();
    }
    throw new ApiError(res.status, body.error ?? 'تعذّر الاتصال بالخادم');
  }
  return body as T;
}

/**
 * Same timeout/abort/error-translation hardening as `request()`, but returns
 * the raw `Response` instead of parsing it as JSON — for the handful of
 * endpoints that send/receive something other than a JSON body (multipart
 * uploads, a binary backup download, a DELETE with no body). Without this,
 * these calls used a bare `fetch()` with no timeout and no try/catch, so a
 * dropped connection either hung the UI on "جارٍ الحفظ…" forever or leaked a
 * raw "Failed to fetch" — exactly the bug `request()` itself was hardened
 * against earlier this project.
 */
async function rawFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${getServerUrl()}/api${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    onConnectionResult?.(false);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'انتهت مهلة الاتصال بالخادم — تحقّق من الشبكة');
    }
    throw new ApiError(0, 'تعذّر الاتصال بالخادم — تحقّق من الشبكة أو عنوان الخادم');
  } finally {
    clearTimeout(timeout);
  }

  onConnectionResult?.(true);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && token) {
      onUnauthorized?.();
    }
    throw new ApiError(res.status, body.error ?? 'تعذّر الاتصال بالخادم');
  }
  return res;
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  /** Validates a saved token and returns who it belongs to — used to restore a session on launch without asking for a password again. */
  me: () => request<User>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  /** Unauthenticated — the connection poll uses it before login too. */
  health: () => request<{ ok: boolean; lanUrl?: string }>('/health'),

  dashboard: () => request<DashboardSummary>('/dashboard'),

  categories: () => request<Category[]>('/categories'),
  createCategory: (name: string) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  /** Products keep existing — the relation is onDelete: SetNull, so they just lose the link. */
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' }),

  /**
   * The server caps how many rows it returns, so pass a limit that suits the
   * screen rather than assuming the whole catalogue comes back.
   */
  products: (
    search?: string,
    opts: { status?: 'low' | 'expiring' | 'out'; limit?: number; offset?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (opts.status) params.set('status', opts.status);
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts.offset !== undefined) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return request<Product[]>(`/products${qs ? `?${qs}` : ''}`);
  },
  productStats: (search?: string) =>
    request<{ total: number; low: number; expiring: number; out: number }>(
      `/products/stats${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  productById: (id: number) => request<Product>(`/products/${id}`),
  productByBarcode: (barcode: string) =>
    request<Product>(`/products/barcode/${encodeURIComponent(barcode)}`),
  /** Suggestions only — a failure here must not block adding a product. */
  productIngredients: () => request<string[]>('/products/ingredients'),
  /** In-stock products sharing this one's active ingredient. */
  productAlternatives: (id: number) =>
    request<ProductAlternative[]>(`/products/${id}/alternatives`),
  createProduct: (data: ProductInput) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: number, data: ProductInput) =>
    request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: number) => request<void>(`/products/${id}`, { method: 'DELETE' }),
  /** The URL behind the QR code — short-lived, and good only for this product's photo. */
  createCaptureToken: (id: number) =>
    request<{ url: string; expiresInSeconds: number }>(`/products/${id}/capture-token`, {
      method: 'POST',
    }),
  /** Multipart upload — bypasses the JSON-only `request()` helper on purpose. */
  uploadProductImage: async (id: number, blob: Blob): Promise<{ imageFilename: string }> => {
    const form = new FormData();
    form.append('image', blob, 'photo.jpg');
    const res = await rawFetch(`/products/${id}/image`, { method: 'POST', body: form });
    return res.json();
  },

  batches: (productId?: number) =>
    request<Batch[]>(`/batches${productId ? `?productId=${productId}` : ''}`),
  createBatch: (data: BatchInput) =>
    request<Batch>('/batches', { method: 'POST', body: JSON.stringify(data) }),
  /** Expiry/batch number only — quantity is deliberately not editable here. */
  updateBatch: (id: number, data: { expiryDate: string | null; batchNumber: string | null }) =>
    request<Batch>(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBatch: (id: number) => request<void>(`/batches/${id}`, { method: 'DELETE' }),
  writeOffBatch: (id: number) => request<Batch>(`/batches/${id}/write-off`, { method: 'POST' }),

  createSale: (data: SaleInput) =>
    request<Sale>('/sales', { method: 'POST', body: JSON.stringify(data) }),
  saleById: (id: number) => request<SaleDetail>(`/sales/${id}`),
  /** Same-day browse list for the returns screen — admin/pharmacist only, matching the server's role gate. */
  salesByDate: (date: string) => request<SaleListItem[]>(`/sales${rangeQuery(date, date)}`),

  suppliers: () => request<Supplier[]>('/suppliers'),
  createSupplier: (data: SupplierInput) =>
    request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: SupplierInput) =>
    request<Supplier>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: number) => request<void>(`/suppliers/${id}`, { method: 'DELETE' }),

  purchases: () => request<Purchase[]>('/purchases'),
  createPurchase: (data: PurchaseInput) =>
    request<Purchase>('/purchases', { method: 'POST', body: JSON.stringify(data) }),

  returns: () => request<Return[]>('/returns'),
  createReturn: (data: ReturnInput) =>
    request<Return>('/returns', { method: 'POST', body: JSON.stringify(data) }),

  users: () => request<User[]>('/users'),
  createUser: (data: UserInput) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number, data: UserInput) =>
    request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),

  reportSales: (from?: string, to?: string) =>
    request<SalesReportPoint[]>(`/reports/sales${rangeQuery(from, to)}`),
  reportTopProducts: (from?: string, to?: string) =>
    request<TopProductPoint[]>(`/reports/top-products${rangeQuery(from, to)}`),
  reportProfit: (from?: string, to?: string) =>
    request<ProfitReportPoint[]>(`/reports/profit${rangeQuery(from, to)}`),
  reportByCategory: (from?: string, to?: string) =>
    request<CategoryRevenuePoint[]>(`/reports/by-category${rangeQuery(from, to)}`),
  /** `to` is an expiry cut-off here, not a sales window. */
  reportExpiry: (from?: string, to?: string) =>
    request<ExpiryReportRow[]>(`/reports/expiry${rangeQuery(from, to)}`),
  reportLowStock: () => request<LowStockReportRow[]>('/reports/low-stock'),
  reportWriteOffs: () => request<WriteOffReportRow[]>('/reports/write-offs'),

  backups: () => request<BackupFile[]>('/backup'),
  /** Stores a downloaded backup on this machine (nothing is replaced until it is restored). */
  importBackup: async (file: Blob): Promise<{ name: string }> => {
    const form = new FormData();
    form.append('file', file, 'backup.json');
    const res = await rawFetch('/backup/import', { method: 'POST', body: form });
    return res.json();
  },
  /** Replaces the whole database with this backup — the server snapshots the current state first. */
  restoreBackup: (name: string) =>
    request<void>(`/backup/${encodeURIComponent(name)}/restore`, {
      method: 'POST',
      body: JSON.stringify({ confirm: 'RESTORE' }),
    }),

  branding: () => request<BrandingInfo>('/branding'),
  uploadLogo: async (blob: Blob): Promise<BrandingInfo> => {
    const form = new FormData();
    form.append('logo', blob, 'logo.png');
    const res = await rawFetch('/branding/logo', { method: 'POST', body: form });
    return res.json();
  },
  deleteLogo: async (): Promise<void> => {
    await rawFetch('/branding/logo', { method: 'DELETE' });
  },
  /** Streams one backup file down and hands it to the main process to save via a native "Save As" dialog. */
  downloadBackup: async (name: string): Promise<void> => {
    const res = await rawFetch(`/backup/${encodeURIComponent(name)}`);
    await window.pharmacy.saveFile(name, await res.arrayBuffer());
  },
};

function rangeQuery(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
