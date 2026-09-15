const mongoose = require('mongoose');

const connectionStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Connect to MongoDB Atlas with retry logic and event listeners.
 */
const connectDB = async (retries = 3, delay = 2000) => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('[DB] FATAL: MONGO_URI environment variable is not defined.');
    process.exit(1);
  }

  const options = {
    dbName: 'shopsphere',
    serverSelectionTimeoutMS: 15000, // 15 seconds for Atlas SRV/TLS handshake
    maxPoolSize: 10,
  };

  // Attach event listeners once
  if (mongoose.connection.listenerCount('connected') === 0) {
    mongoose.connection.on('connected', () => {
      console.log(
        `[DB] Connected to MongoDB Atlas host: ${mongoose.connection.host} (DB: ${mongoose.connection.name})`
      );
    });

    mongoose.connection.on('error', (err) => {
      console.error('[DB] Connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] Connection disconnected.');
    });
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(uri, options);
      return conn;
    } catch (err) {
      console.error(`[DB] Connection attempt ${attempt} of ${retries} failed: ${err.message}`);
      if (attempt === retries) {
        throw err;
      }
      console.log(`[DB] Retrying connection in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

/**
 * Health check helper for database connection status.
 */
const isDBConnected = () => {
  const stateCode = mongoose.connection.readyState;
  return {
    isConnected: stateCode === 1,
    state: connectionStates[stateCode] || 'unknown',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
};

/**
 * Cleanly disconnect from database (for graceful shutdown and tests).
 */
const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB cleanly.');
  }
};

module.exports = {
  connectDB,
  isDBConnected,
  disconnectDB,
};
