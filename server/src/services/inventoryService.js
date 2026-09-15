const Product = require('../models/Product');
const { ConflictError } = require('../utils/AppError');

/**
 * Atomically reserve inventory for an array of cart items.
 *
 * Uses conditional MongoDB atomic decrements (`$inc: { stock: -qty }` where `stock >= qty`).
 * If any single item fails reservation (e.g. concurrent race condition), all previously
 * decremented items in the transaction batch are rolled back immediately.
 *
 * @param {Array<{ productId: string, quantity: number, name?: string }>} items
 * @returns {Promise<Array<{ productId: string, quantity: number }>>} Successfully reserved items
 */
const reserveInventory = async (items) => {
  const reservedItems = [];

  try {
    for (const item of items) {
      const productId = item.productId || item.product?._id || item.product;
      const quantity = item.quantity;

      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: productId,
          stock: { $gte: quantity },
          isActive: true,
        },
        {
          $inc: { stock: -quantity },
        },
        { returnDocument: 'after' }
      );

      if (!updatedProduct) {
        // Query to provide rich conflict diagnostic
        const currentProduct = await Product.findById(productId);
        const productName = currentProduct ? currentProduct.name : item.name || 'Product';
        const availableStock = currentProduct ? currentProduct.stock : 0;

        throw new ConflictError(
          `Insufficient inventory for '${productName}'. Available stock: ${availableStock}, requested: ${quantity}.`,
          'OUT_OF_STOCK'
        );
      }

      reservedItems.push({ productId, quantity });
    }

    return reservedItems;
  } catch (err) {
    // Compensating Rollback: Restore any already-reserved items in this transaction
    for (const reserved of reservedItems) {
      try {
        await Product.updateOne(
          { _id: reserved.productId },
          { $inc: { stock: reserved.quantity } }
        );
      } catch (rollbackErr) {
        console.error(
          `[InventoryService ⚠️] Failed to rollback stock for product ${reserved.productId}:`,
          rollbackErr.message
        );
      }
    }
    throw err;
  }
};

/**
 * Atomically release/restore inventory back to products (e.g. upon order cancellation or TTL expiration).
 *
 * @param {Array<{ product: string|object, quantity: number }>} items
 */
const releaseInventory = async (items) => {
  if (!items || items.length === 0) return;

  for (const item of items) {
    const productId = item.product?._id || item.product || item.productId;
    const quantity = item.quantity;

    try {
      await Product.updateOne(
        { _id: productId },
        { $inc: { stock: quantity } }
      );
    } catch (err) {
      console.error(
        `[InventoryService ⚠️] Failed to release inventory for product ${productId}:`,
        err.message
      );
    }
  }
};

module.exports = {
  reserveInventory,
  releaseInventory,
};
