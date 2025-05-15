import mongoose from "mongoose";
import Order from "../models/Order/Order.js";
import Product from "../models/Product/Product.js";

/**
 * Order Status Lifecycle
 *
 * Initialized: Order created but payment not attempted
 * Draft: Order in progress (saved but incomplete)
 * Pending: Payment initiated but not confirmed
 * Processing: Payment received, preparing for shipment
 * Shipped: Order has been shipped
 * Delivered: Order has been delivered
 * Cancelled: Order has been cancelled
 * Completed: Order fully completed
 */

/**
 * Cleans up abandoned orders that haven't been paid
 * @param {number} timeoutMinutes - Minutes after which unpaid orders should be cancelled
 * @returns {Promise<number>} - Number of orders cleaned up
 */
export const cleanupAbandonedOrders = async (timeoutMinutes = 60) => {
  try {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    // Find orders that are still in Initialized or Pending state and older than the cutoff time
    const abandonedOrders = await Order.find({
      status: { $in: ["Initialized", "Pending"] },
      isPaid: false,
      createdAt: { $lt: cutoffTime },
    });

    console.log(
      `Found ${abandonedOrders.length} abandoned orders older than ${timeoutMinutes} minutes`
    );

    // Process each abandoned order
    let processedCount = 0;

    for (const order of abandonedOrders) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Update order status to Cancelled
        order.status = "Cancelled";
        order.notes = `${
          order.notes ? order.notes + ". " : ""
        }Order automatically cancelled due to payment timeout after ${timeoutMinutes} minutes.`;

        await order.save({ session });

        console.log(`Cancelled abandoned order ${order._id}`);
        processedCount++;

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        console.error(`Error processing abandoned order ${order._id}:`, error);
      } finally {
        session.endSession();
      }
    }

    return processedCount;
  } catch (error) {
    console.error("Error cleaning up abandoned orders:", error);
    return 0;
  }
};

/**
 * Updates order status and handles side effects
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 * @param {Object} updates - Additional updates to apply
 * @returns {Promise<Object>} - Updated order
 */
export const updateOrderStatus = async (orderId, status, updates = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(`Order not found: ${orderId}`);
    }

    const oldStatus = order.status;

    // Update the order
    order.status = status;

    // Apply additional updates
    Object.keys(updates).forEach((key) => {
      order[key] = updates[key];
    });

    // Special handling based on status transition
    if (status === "Cancelled" && oldStatus !== "Cancelled") {
      // Return items to inventory if order is cancelled
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.product,
            {
              $inc: {
                quantity: item.quantity,
                sold: -item.quantity,
              },
            },
            { session }
          );
        }
      }
    }

    // Save the order
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return order;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export default {
  cleanupAbandonedOrders,
  updateOrderStatus,
};
