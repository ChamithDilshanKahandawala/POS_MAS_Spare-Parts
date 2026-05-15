// index.js — MAS Local Print Agent
// Express HTTP server that receives receipt JSON and sends ESC/POS to printer.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { logger } from './logger.js';
import { printReceipt, printTestReceipt, openDrawer, checkPrinterReachable } from './printer.js';

const PORT          = process.env.AGENT_PORT    || 9100;
const PRINTER_PATH  = process.env.WINDOWS_PRINTER_PATH || '\\\\DESKTOP-KR9L0QV\\POS-80C';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

const app = express();

// ── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Postman, curl, same-machine fetch)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    logger.warn('CORS blocked', { origin });
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '1mb' }));

// ── REQUEST LOGGING ─────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ── ROUTES ──────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Returns agent status and whether the printer is reachable.
 */
app.get('/health', async (_req, res) => {
  const printerReachable = await checkPrinterReachable();
  res.json({
    status:           'ok',
    printerReachable,
    printerPath:      PRINTER_PATH,
    version:          '1.0.0',
    uptime:           process.uptime(),
    timestamp:        new Date().toISOString(),
  });
});

/**
 * GET /test
 * Prints a hardcoded test receipt. Use during initial setup to verify
 * the printer and agent are working end-to-end.
 */
app.get('/test', async (_req, res) => {
  try {
    logger.info('Test print requested');
    await printTestReceipt();
    logger.print('TEST-001', 'success');
    res.json({ success: true, message: 'Test receipt sent to printer' });
  } catch (err) {
    logger.print('TEST-001', 'failed', err.message);
    logger.error('Test print failed', { error: err.message });
    res.status(500).json({
      success: false,
      error:   err.message,
      hint:    'Check that the printer is powered on and the Windows share is accessible.',
    });
  }
});

/**
 * POST /print
 * Body: { sale: { ... } }
 * Main endpoint. Called by the frontend printService after a sale completes.
 */
app.post('/print', async (req, res) => {
  const sale = req.body?.sale;
  const saleId = sale?.id || sale?.invoice_number || sale?._id || 'unknown';

  if (!sale) {
    logger.warn('POST /print received empty body');
    return res.status(400).json({ success: false, error: 'Missing sale data in request body' });
  }

  try {
    logger.info('Print job received', { saleId });
    await printReceipt(sale);
    logger.print(saleId, 'success');
    res.json({ success: true, saleId });
  } catch (err) {
    logger.print(saleId, 'failed', err.message);
    logger.error('Print failed', { saleId, error: err.message });

    // Return a structured error so the frontend can show a useful message
    const code = classifyError(err.message);
    res.status(500).json({
      success: false,
      saleId,
      error:   err.message,
      code,
    });
  }
});

/**
 * POST /open-drawer
 * Sends only a cash drawer kick. For manager use mid-shift.
 */
app.post('/open-drawer', async (_req, res) => {
  try {
    await openDrawer();
    logger.info('Drawer opened via /open-drawer');
    res.json({ success: true, message: 'Cash drawer opened' });
  } catch (err) {
    logger.error('Drawer kick failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── ERROR CLASSIFIER ────────────────────────────────────────────────────────
function classifyError(message = '') {
  const m = message.toLowerCase();
  if (m.includes('offline') || m.includes('unreachable') || m.includes('connect')) return 'PRINTER_OFFLINE';
  if (m.includes('paper') || m.includes('media'))   return 'OUT_OF_PAPER';
  if (m.includes('timeout'))                         return 'TIMEOUT';
  if (m.includes('access') || m.includes('denied')) return 'ACCESS_DENIED';
  return 'UNKNOWN';
}

// ── 404 CATCH-ALL ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', endpoints: ['GET /health', 'GET /test', 'POST /print', 'POST /open-drawer'] });
});

// ── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  logger.info(`MAS Print Agent started`, { port: PORT, printerPath: PRINTER_PATH });
  logger.info(`Endpoints: http://localhost:${PORT}/health | /test | /print | /open-drawer`);
});

export default app;
