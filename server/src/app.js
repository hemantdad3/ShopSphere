const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { isDBConnected } = require('./config/db');
const { NotFoundError } = require('./utils/AppError');
const errorHandler = require('./middleware/errorHandler');

// Route Handlers
const authRoutes = require('./routes/authRoutes');

const app = express();

// HTTP Request Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Security & Parsing Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Comprehensive Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = isDBConnected();

  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'ShopSphere API is operating normally',
    db: dbStatus.state,
    database: {
      connected: dbStatus.isConnected,
      state: dbStatus.state,
      name: dbStatus.name,
    },
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    memoryUsage: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
    },
  });
});

// API Route Mounts
app.use('/api/auth', authRoutes);

// Handle 404 for unmatched routes
app.all('*', (req, res, next) => {
  next(new NotFoundError(`Cannot find endpoint ${req.method} ${req.originalUrl} on this server`));
});

// Global Centralized Error Handler
app.use(errorHandler);

module.exports = app;
