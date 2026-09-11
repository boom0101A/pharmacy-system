/**
 * The server address. On the till machines this points at the LAN IP of the
 * machine running the server (e.g. http://192.168.1.10:3000), which the user
 * sets once in Settings; it is kept in localStorage so it survives restarts.
 */
const SERVER_KEY = 'pharmacy.serverUrl';
const TOKEN_KEY = 'pharmacy.token';
export function getServerUrl() {
    return localStorage.getItem(SERVER_KEY) ?? 'http://localhost:3000';
}
export function setServerUrl(url) {
    localStorage.setItem(SERVER_KEY, url.replace(/\/$/, ''));
}
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
    if (token)
        localStorage.setItem(TOKEN_KEY, token);
    else
        localStorage.removeItem(TOKEN_KEY);
}
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
/**
 * Registered once by the auth store so a 401 on an authenticated request can
 * trigger a clean logout instead of leaving the app stuck on a broken screen.
 * A callback (not a direct import of the store) avoids a circular import,
 * since the auth store already imports from this file.
 */
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
    onUnauthorized = handler;
}
/**
 * Registered by the connection store, for the same circular-import reason.
 * Called after every request: reaching the server at all counts as online,
 * even when it answers with an error status.
 */
let onConnectionResult = null;
export function setConnectionResultHandler(handler) {
    onConnectionResult = handler;
}
async function request(path, options = {}) {
    const token = getToken();
    let res;
    try {
        res = await fetch(`${getServerUrl()}/api${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
        });
    }
    catch {
        onConnectionResult?.(false);
        throw new ApiError(0, 'تعذّر الاتصال بالخادم — تحقّق من الشبكة أو عنوان الخادم');
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
    return body;
}
export const api = {
    login: (username, password) => request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    }),
    /** Validates a saved token and returns who it belongs to — used to restore a session on launch without asking for a password again. */
    me: () => request('/auth/me'),
    /** Unauthenticated — the connection poll uses it before login too. */
    health: () => request('/health'),
    dashboard: () => request('/dashboard'),
    categories: () => request('/categories'),
    createCategory: (name) => request('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
    /** Products keep existing — the relation is onDelete: SetNull, so they just lose the link. */
    deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
    /**
     * The server caps how many rows it returns, so pass a limit that suits the
     * screen rather than assuming the whole catalogue comes back.
     */
    products: (search, opts = {}) => {
        const params = new URLSearchParams();
        if (search)
            params.set('search', search);
        if (opts.status)
            params.set('status', opts.status);
        if (opts.limit !== undefined)
            params.set('limit', String(opts.limit));
        if (opts.offset !== undefined)
            params.set('offset', String(opts.offset));
        const qs = params.toString();
        return request(`/products${qs ? `?${qs}` : ''}`);
    },
    productStats: (search) => request(`/products/stats${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    productByBarcode: (barcode) => request(`/products/barcode/${encodeURIComponent(barcode)}`),
    /** Suggestions only — a failure here must not block adding a product. */
    productIngredients: () => request('/products/ingredients'),
    /** In-stock products sharing this one's active ingredient. */
    productAlternatives: (id) => request(`/products/${id}/alternatives`),
    createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
    /** The URL behind the QR code — short-lived, and good only for this product's photo. */
    createCaptureToken: (id) => request(`/products/${id}/capture-token`, {
        method: 'POST',
    }),
    /** Multipart upload — bypasses the JSON-only `request()` helper on purpose. */
    uploadProductImage: async (id, blob) => {
        const token = getToken();
        const form = new FormData();
        form.append('image', blob, 'photo.jpg');
        const res = await fetch(`${getServerUrl()}/api/products/${id}/image`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok)
            throw new ApiError(res.status, body.error ?? 'تعذّر رفع الصورة');
        return body;
    },
    batches: (productId) => request(`/batches${productId ? `?productId=${productId}` : ''}`),
    createBatch: (data) => request('/batches', { method: 'POST', body: JSON.stringify(data) }),
    /** Expiry/batch number only — quantity is deliberately not editable here. */
    updateBatch: (id, data) => request(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBatch: (id) => request(`/batches/${id}`, { method: 'DELETE' }),
    createSale: (data) => request('/sales', { method: 'POST', body: JSON.stringify(data) }),
    saleById: (id) => request(`/sales/${id}`),
    /** Same-day browse list for the returns screen — admin/pharmacist only, matching the server's role gate. */
    salesByDate: (date) => request(`/sales${rangeQuery(date, date)}`),
    suppliers: () => request('/suppliers'),
    createSupplier: (data) => request('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
    updateSupplier: (id, data) => request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSupplier: (id) => request(`/suppliers/${id}`, { method: 'DELETE' }),
    purchases: () => request('/purchases'),
    createPurchase: (data) => request('/purchases', { method: 'POST', body: JSON.stringify(data) }),
    returns: () => request('/returns'),
    createReturn: (data) => request('/returns', { method: 'POST', body: JSON.stringify(data) }),
    users: () => request('/users'),
    createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
    reportSales: (from, to) => request(`/reports/sales${rangeQuery(from, to)}`),
    reportTopProducts: (from, to) => request(`/reports/top-products${rangeQuery(from, to)}`),
    reportProfit: (from, to) => request(`/reports/profit${rangeQuery(from, to)}`),
    reportByCategory: (from, to) => request(`/reports/by-category${rangeQuery(from, to)}`),
    /** `to` is an expiry cut-off here, not a sales window. */
    reportExpiry: (from, to) => request(`/reports/expiry${rangeQuery(from, to)}`),
    reportLowStock: () => request('/reports/low-stock'),
    backups: () => request('/backup'),
    branding: () => request('/branding'),
    uploadLogo: async (blob) => {
        const token = getToken();
        const form = new FormData();
        form.append('logo', blob, 'logo.png');
        const res = await fetch(`${getServerUrl()}/api/branding/logo`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok)
            throw new ApiError(res.status, body.error ?? 'تعذّر رفع الشعار');
        return body;
    },
    deleteLogo: async () => {
        const token = getToken();
        const res = await fetch(`${getServerUrl()}/api/branding/logo`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new ApiError(res.status, body.error ?? 'تعذّر حذف الشعار');
        }
    },
    /** Streams one backup file down and hands it to the main process to save via a native "Save As" dialog. */
    downloadBackup: async (name) => {
        const token = getToken();
        const res = await fetch(`${getServerUrl()}/api/backup/${encodeURIComponent(name)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new ApiError(res.status, body.error ?? 'تعذّر تنزيل النسخة الاحتياطية');
        }
        await window.pharmacy.saveFile(name, await res.arrayBuffer());
    },
};
function rangeQuery(from, to) {
    const params = new URLSearchParams();
    if (from)
        params.set('from', from);
    if (to)
        params.set('to', to);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}
