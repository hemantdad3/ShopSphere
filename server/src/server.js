require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[ShopSphere API] Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`[ShopSphere API] Health check available at: http://localhost:${PORT}/api/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[ShopSphere API] Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[ShopSphere API] Uncaught Exception:', err.message);
  process.exit(1);
});
