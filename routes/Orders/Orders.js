import express from "express";
import {
  deleteOrder,
  getOrderById,
  getOrderStats,
  getOrders,
  updateOrder,
} from "../../controllers/Orders/Orders.js";
import { adminOnly, protect } from "../../middleware/auth.js";

const router = express.Router();

/**
 * @route   GET /api/orders
 * @desc    Get all orders (admin) or user orders
 * @access  Private
 */
router.get("/", protect, getOrders);

/**
 * @route   GET /api/orders/stats/summary
 * @desc    Get order statistics
 * @access  Private (Admin)
 */
router.get("/stats/summary", protect, adminOnly, getOrderStats);

/**
 * @route   GET /api/orders/:id
 * @desc    Get a single order
 * @access  Private
 */
router.get("/:id", protect, getOrderById);

/**
 * @route   PUT /api/orders/:id
 * @desc    Update order status
 * @access  Private (Admin)
 */
router.put("/:id", protect, adminOnly, updateOrder);

/**
 * @route   DELETE /api/orders/:id
 * @desc    Delete order (admin only)
 * @access  Private (Admin)
 */
router.delete("/:id", protect, adminOnly, deleteOrder);

export default router;
