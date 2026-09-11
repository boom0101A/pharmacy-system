import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { initStockSocket } from './sockets/stock.js';
import { logger } from './lib/logger.js';
import { createBackup } from './backup.js';

const server = createServer(app);
initStockSocket(server);

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

server.listen(config.port, '0.0.0.0', () => {
  logger.info(`Pharmacy server listening on http://0.0.0.0:${config.port}`);
  createBackup();
  setInterval(createBackup, BACKUP_INTERVAL_MS);
});
