const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Middleware imports
const { protect, adminOnly } = require('./middleware/authMiddleware');

dotenv.config();
connectDB();

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// --- ROUTES ---

// Auth & User Management
app.use('/api/auth',      require('./routes/authRoutes'));
app.use('/api/users',     require('./routes/userRoutes')); // 👈 ALUTHIN ADD KALA

// Business Logic
app.use('/api/products',  require('./routes/productRoutes'));
app.use('/api/sales',     require('./routes/saleRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/returns',   require('./routes/returnRoutes'));

// Excel import/export (Admins only for data safety)
const { importProducts, exportProducts, upload } = require('./controllers/excelController');

// Mektath adminOnly middleware eka add kala security ekata
app.post('/api/products/import', protect, adminOnly, upload.single('file'), importProducts);
app.get('/api/products/export',  protect, adminOnly, exportProducts);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Server Error' });
});

// Port configuration (MacBook friendly 5001)
const PORT = process.env.PORT || 5001; 
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));