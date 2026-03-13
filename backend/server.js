const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { startAutoBackupScheduler } = require('./backup');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isPrivateNetworkOrigin = (origin) => {
  return /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
};

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isPrivateNetworkOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes placeholder
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'PharmaDesk Backend Ready' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stock-history', require('./routes/stock-history'));
app.use('/api/receiving', require('./routes/receiving'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'PharmaDesk Backend Ready' }));

// DB connection
require('./db');
const autoBackup = startAutoBackupScheduler();

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, HOST, () => {
  console.log(`PharmaDesk Backend running on http://${HOST}:${PORT}`);
  console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  if (autoBackup.enabled) {
    console.log(`Automatic backup enabled at ${autoBackup.schedule} (keep latest ${autoBackup.keepLatest})`);
  } else {
    console.log('Automatic backup disabled');
  }
});
