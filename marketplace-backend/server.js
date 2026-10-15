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

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // No Origin header (curl, server-to-server, same-origin) — allow.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Apexora marketplace API' }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Centralized error handler — a thrown/rejected error in any route lands
// here instead of crashing the process or leaking a stack trace to the
// client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5002;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Apexora marketplace API listening on port ${PORT} (NODE_ENV=${NODE_ENV})`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
