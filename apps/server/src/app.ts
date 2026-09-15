import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { categoriesRouter } from './routes/misc.routes.js';
import { productsRouter } from './routes/products.routes.js';
import { batchesRouter } from './routes/batches.routes.js';
import { salesRouter } from './routes/sales.routes.js';
import { returnsRouter } from './routes/returns.routes.js';
import { suppliersRouter } from './routes/suppliers.routes.js';
import { purchasesRouter } from './routes/purchases.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { backupRouter } from './routes/backup.routes.js';
import { brandingRouter } from './routes/branding.routes.js';
import { captureRouter } from './routes/capture.routes.js';
import { captureLinkRouter } from './routes/captureLink.routes.js';
import { errorHandler } from './middleware/errors.js';
import { config } from './config.js';
import { lanServerUrl } from './lib/lanUrl.js';


export const app = express();

app.use(cors());
app.use(express.json());

// Product photos, served straight off disk.
app.use('/uploads', express.static(config.uploadsDir));
// The phone-facing capture page (scanned from the desktop's QR code).
app.use('/capture', express.static(path.join(config.publicDir, 'capture')));
// Short redirect a QR code can actually fit: /c/<code> -> the capture page + token.
app.use('/c', captureLinkRouter);

// `lanUrl` is what the user reads off Settings and types into a second till —
// the machine cannot discover its own network address from the other side.
app.get('/api/health', (_req, res) => res.json({ ok: true, lanUrl: lanServerUrl() }));

app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/sales', salesRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/backup', backupRouter);
app.use('/api/branding', brandingRouter);
app.use('/api/capture', captureRouter);

// Must be registered last: Express only routes an error to a 4-arg handler.
app.use(errorHandler);
