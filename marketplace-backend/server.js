const path = require('path');
const dotenv = require('dotenv');

// Same pattern as backend/server.js: the NODE_ENV-specific file first
// (dotenv never overrides an already-set var), then the plain .env as a
// fallback for anything that file didn't define.
const NODE_ENV = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, `.env.${NODE_ENV}`) });
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const publicRoutes = require('./routes/publicRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const customerRoutes = require('./routes/customerRoutes');
const { startPosSyncScheduler } = require('./services/posSyncScheduler');
const { startOrderAutoCancelJob } = require('./services/orderAutoCancel');
const { startReturnEscalationJob } = require('./services/returnEscalation');
const { startPosRecordedReminderJob } = require('./services/posRecordedReminder');
const { startLedgerMaturityJob } = require('./services/ledgerMaturity');
const { startPayoutRunJob } = require('./services/payoutRuns');
const { startMessageOutboxJob } = require('./services/messaging');
const { startSellerStatsJob } = require('./services/sellerStats');
const { startOpsAlertsJob, collectHealth } = require('./services/opsAlerts');
const { requestContext } = require('./middleware/requestContext');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Discovered while running the Playwright suite against this server:
// a transient MongoDB Atlas network blip (PoolClearedOnNetworkError)
// rejects whatever in-flight query happened to be mid-flight — including
// ones not awaited by request handlers, e.g. the background sweep jobs
// below — and an unhandled rejection crashes the whole process by
// default in modern Node. Log it instead of going down; the driver
// reconnects and retries on its own once the network recovers.
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { error: String(reason?.message || reason), stack: reason?.stack });
});

const app = express();

app.set('trust proxy', 1);
app.use(requestContext);
app.use(helmet());

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // No Origin header (curl, server-to-server, same-origin) — allow.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const err = new Error('Not allowed by CORS');
    err.statusCode = 403;
    return callback(err);
  },
  credentials: true,
}));

// An explicit, intentional cap rather than Express's own default
// (100kb) — generous enough for the largest legitimate body here (a
// category's full attributeSchema with many options, or a listing's
// localized text fields), small enough that a JSON body can't be used
// to exhaust memory. File uploads go through multer separately (its own
// size limits in middleware/upload.js and middleware/uploadMedia.js) and
// are unaffected by this.
app.use(express.json({ limit: '200kb' }));

app.get('/', (req, res) => res.json({ message: 'Apexora marketplace API' }));

// Uptime checks: 200 when the database answers, 503 otherwise. Counts only —
// nothing here identifies a user or order.
const health = async (req, res) => {
  const result = await collectHealth().catch(() => ({ ok: false, db: 'down' }));
  res.set('Cache-Control', 'no-store');
  res.status(result.ok ? 200 : 503).json(result);
};
app.get('/health', health);
app.get('/api/health', health);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/customer', customerRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5002;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Apexora marketplace API listening on port ${PORT} (NODE_ENV=${NODE_ENV})`);
  });
  // Only runs for a real server start, never when server.js is required
  // as `app` by the test suite — see services/posSyncScheduler.js.
  startPosSyncScheduler();
  startOrderAutoCancelJob();
  startReturnEscalationJob();
  startPosRecordedReminderJob();
  startLedgerMaturityJob();
  startPayoutRunJob();
  startMessageOutboxJob();
  startSellerStatsJob();
  startOpsAlertsJob();
}

if (require.main === module) {
  start();
}

module.exports = app;
