import type { BackupFile, Batch, BatchInput, BrandingInfo, Category, CategoryRevenuePoint, DashboardSummary, ExpiryReportRow, LowStockReportRow, LoginResponse, Product, ProductAlternative, ProductInput, ProfitReportPoint, Purchase, PurchaseInput, Return, ReturnInput, Sale, SaleDetail, SaleInput, SaleListItem, SalesReportPoint, Supplier, SupplierInput, TopProductPoint, User, UserInput } from '@pharmacy/shared-types';
export declare function getServerUrl(): string;
export declare function setServerUrl(url: string): void;
export declare function getToken(): string | null;
export declare function setToken(token: string | null): void;
export declare class ApiError extends Error {
    status: number;
    constructor(status: number, message: string);
}
export declare function setUnauthorizedHandler(handler: () => void): void;
export declare function setConnectionResultHandler(handler: (online: boolean) => void): void;
export declare const api: {
    login: (username: string, password: string) => Promise<LoginResponse>;
    /** Validates a saved token and returns who it belongs to — used to restore a session on launch without asking for a password again. */
    me: () => Promise<User>;
    /** Unauthenticated — the connection poll uses it before login too. */
    health: () => Promise<{
        ok: boolean;
    }>;
    dashboard: () => Promise<DashboardSummary>;
    categories: () => Promise<Category[]>;
    createCategory: (name: string) => Promise<Category>;
    /** Products keep existing — the relation is onDelete: SetNull, so they just lose the link. */
    deleteCategory: (id: number) => Promise<void>;
    /**
     * The server caps how many rows it returns, so pass a limit that suits the
     * screen rather than assuming the whole catalogue comes back.
     */
    products: (search?: string, opts?: {
        status?: "low" | "expiring" | "out";
        limit?: number;
        offset?: number;
    }) => Promise<Product[]>;
    productStats: (search?: string) => Promise<{
        total: number;
        low: number;
        expiring: number;
        out: number;
    }>;
    productByBarcode: (barcode: string) => Promise<Product>;
    /** Suggestions only — a failure here must not block adding a product. */
    productIngredients: () => Promise<string[]>;
    /** In-stock products sharing this one's active ingredient. */
    productAlternatives: (id: number) => Promise<ProductAlternative[]>;
    createProduct: (data: ProductInput) => Promise<Product>;
    updateProduct: (id: number, data: ProductInput) => Promise<Product>;
    deleteProduct: (id: number) => Promise<void>;
    /** The URL behind the QR code — short-lived, and good only for this product's photo. */
    createCaptureToken: (id: number) => Promise<{
        url: string;
        expiresInSeconds: number;
    }>;
    /** Multipart upload — bypasses the JSON-only `request()` helper on purpose. */
    uploadProductImage: (id: number, blob: Blob) => Promise<{
        imageFilename: string;
    }>;
    batches: (productId?: number) => Promise<Batch[]>;
    createBatch: (data: BatchInput) => Promise<Batch>;
    /** Expiry/batch number only — quantity is deliberately not editable here. */
    updateBatch: (id: number, data: {
        expiryDate: string | null;
        batchNumber: string | null;
    }) => Promise<Batch>;
    deleteBatch: (id: number) => Promise<void>;
    createSale: (data: SaleInput) => Promise<Sale>;
    saleById: (id: number) => Promise<SaleDetail>;
    /** Same-day browse list for the returns screen — admin/pharmacist only, matching the server's role gate. */
    salesByDate: (date: string) => Promise<SaleListItem[]>;
    suppliers: () => Promise<Supplier[]>;
    createSupplier: (data: SupplierInput) => Promise<Supplier>;
    updateSupplier: (id: number, data: SupplierInput) => Promise<Supplier>;
    deleteSupplier: (id: number) => Promise<void>;
    purchases: () => Promise<Purchase[]>;
    createPurchase: (data: PurchaseInput) => Promise<Purchase>;
    returns: () => Promise<Return[]>;
    createReturn: (data: ReturnInput) => Promise<Return>;
    users: () => Promise<User[]>;
    createUser: (data: UserInput) => Promise<User>;
    updateUser: (id: number, data: UserInput) => Promise<User>;
    deleteUser: (id: number) => Promise<void>;
    reportSales: (from?: string, to?: string) => Promise<SalesReportPoint[]>;
    reportTopProducts: (from?: string, to?: string) => Promise<TopProductPoint[]>;
    reportProfit: (from?: string, to?: string) => Promise<ProfitReportPoint[]>;
    reportByCategory: (from?: string, to?: string) => Promise<CategoryRevenuePoint[]>;
    /** `to` is an expiry cut-off here, not a sales window. */
    reportExpiry: (from?: string, to?: string) => Promise<ExpiryReportRow[]>;
    reportLowStock: () => Promise<LowStockReportRow[]>;
    backups: () => Promise<BackupFile[]>;
    branding: () => Promise<BrandingInfo>;
    uploadLogo: (blob: Blob) => Promise<BrandingInfo>;
    deleteLogo: () => Promise<void>;
    /** Streams one backup file down and hands it to the main process to save via a native "Save As" dialog. */
    downloadBackup: (name: string) => Promise<void>;
};
