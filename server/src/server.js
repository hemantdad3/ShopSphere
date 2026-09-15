require('dotenv').config();
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;
let server;

/**
 * Bootstrap application server and database connection
 */
const startServer = async () => {
  try {
    // 1. Establish database connection
    await connectDB();

    // 2. Start HTTP server
    server = app.listen(PORT, () => {
      console.log(
        `[ShopSphere API] Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`
      );
      console.log(`[ShopSphere API] Health endpoint ready at: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('[ShopSphere API] Failed to start server:', err.message);
    process.exit(1);
  }
};

/**
 * Graceful Shutdown Handler
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n[ShopSphere API] Received ${signal}. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('[ShopSphere API] Closed remaining HTTP connections.');
      try {
        await disconnectDB();
        console.log('[ShopSphere API] Graceful shutdown complete.');
        process.exit(0);
      } catch (err) {
        console.error('[ShopSphere API] Error during database disconnect:', err.message);
        process.exit(1);
      }
    });

    // Force exit after 10 seconds if shutdown hangs
    setTimeout(() => {
      console.error('[ShopSphere API] Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Process termination listeners
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Process error handlers
process.on('unhandledRejection', (err) => {
  console.error('[ShopSphere API 💥] Unhandled Rejection:', err.message);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  console.error('[ShopSphere API 💥] Uncaught Exception:', err.message);
  process.exit(1);
});

startServer();
