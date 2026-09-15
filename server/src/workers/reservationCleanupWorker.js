const Order = require('../models/Order');
const inventoryService = require('../services/inventoryService');

let cleanupTimer = null;

/**
 * Scan database for expired PENDING_PAYMENT reservations and release inventory.
 *
 * Uses atomic status transitions (`orderStatus: 'PENDING_PAYMENT'`) to eliminate
 * race conditions with concurrent payment completions.
 *
 * @returns {Promise<number>} Count of expired orders processed
 */
const cleanupExpiredReservations = async () => {
  try {
    const now = new Date();

    // Find all expired pending orders
    const expiredOrders = await Order.find({
      orderStatus: 'PENDING_PAYMENT',
      reservationExpiresAt: { $lte: now },
    });

    if (!expiredOrders || expiredOrders.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const order of expiredOrders) {
      // Atomic state transition: Only cancel if still PENDING_PAYMENT
      // Prevents racing with client/webhook payment verification that may have just succeeded
      const cancelledOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          orderStatus: 'PENDING_PAYMENT',
        },
        {
          orderStatus: 'CANCELLED',
          paymentStatus: 'FAILED',
          cancelledAt: now,
          cancellationReason: 'Payment reservation expired (15-minute TTL)',
        },
        { returnDocument: 'after' }
      );

      if (cancelledOrder) {
        // Restock inventory for all items in order
        await inventoryService.releaseInventory(cancelledOrder.items);
        processedCount++;
        console.log(
          `[Cleanup Worker ⏱️] Order '${cancelledOrder.orderNumber}' reservation expired. Restored inventory for ${cancelledOrder.items.length} items.`
        );
      }
    }

    return processedCount;
  } catch (err) {
    console.error('[Cleanup Worker 💥] Error during reservation cleanup run:', err.message);
    return 0;
  }
};

/**
 * Start recurring background worker
 *
 * @param {number} intervalMs - Poll interval in milliseconds (default: 60,000ms / 1 min)
 */
const startReservationCleanupWorker = (intervalMs = 60000) => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  console.log(`[Cleanup Worker] Initialized reservation TTL monitor (running every ${intervalMs / 1000}s)`);

  // Run immediate initial check
  cleanupExpiredReservations().catch((err) =>
    console.error('[Cleanup Worker] Initial scan error:', err.message)
  );

  cleanupTimer = setInterval(() => {
    cleanupExpiredReservations().catch((err) =>
      console.error('[Cleanup Worker] Periodic scan error:', err.message)
    );
  }, intervalMs);

  // Prevent background timer from blocking process exit
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
};

/**
 * Stop background worker on graceful shutdown
 */
const stopReservationCleanupWorker = () => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('[Cleanup Worker] Reservation TTL worker stopped.');
  }
};

module.exports = {
  cleanupExpiredReservations,
  startReservationCleanupWorker,
  stopReservationCleanupWorker,
};
