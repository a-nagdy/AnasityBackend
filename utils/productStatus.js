import Product from "../models/Product/Product.js";

/**
 * Constants for inventory thresholds
 */
export const INVENTORY_THRESHOLDS = {
  LOW_STOCK: 5, // Consider product low stock when quantity <= 5
};

/**
 * Product statuses
 */
export const PRODUCT_STATUS = {
  IN_STOCK: "in stock",
  LOW_STOCK: "low stock",
  OUT_OF_STOCK: "out of stock",
  DRAFT: "draft",
};

/**
 * Determine product status based on quantity and active state
 * @param {Number} quantity - Product quantity
 * @param {Boolean} active - Whether the product is active or draft
 * @returns {String} Product status
 */
export const determineProductStatus = (quantity, active = true) => {
  if (!active) return PRODUCT_STATUS.DRAFT;

  if (quantity <= 0) return PRODUCT_STATUS.OUT_OF_STOCK;
  if (quantity <= INVENTORY_THRESHOLDS.LOW_STOCK)
    return PRODUCT_STATUS.LOW_STOCK;
  return PRODUCT_STATUS.IN_STOCK;
};

/**
 * Update all product statuses based on their quantities
 * This can be run as a scheduled job
 */
export const updateAllProductStatuses = async () => {
  try {
    // Get all products
    const products = await Product.find({});

    let updates = 0;

    // Update each product's status
    for (const product of products) {
      const currentStatus = product.status;
      const computedStatus = determineProductStatus(
        product.quantity,
        product.active
      );

      // Only update if status has changed
      if (currentStatus !== computedStatus) {
        product.status = computedStatus;
        await product.save();
        updates++;
      }
    }

    return { success: true, updatedProducts: updates };
  } catch (error) {
    console.error("Failed to update product statuses:", error);
    return { success: false, error: error.message };
  }
};
