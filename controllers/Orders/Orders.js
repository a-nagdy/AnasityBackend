import Order from "../../models/Order/Order.js";
import Product from "../../models/Product/Product.js";

/**
 * Get all orders (admin) or user orders
 */
export const getOrders = async (req, res) => {
  try {
    let query = {};
    let options = { sort: { createdAt: -1 } };

    // If not admin, only show user's orders
    if (req.user.role !== "admin" && req.user.role !== "super-admin") {
      query.user = req.user._id;
    } else {
      // Pagination for admin users (who can see all orders)
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      options = {
        ...options,
        skip,
        limit,
      };

      // Filter by status if provided
      if (req.query.status) {
        query.status = req.query.status;
      }

      // Filter by date range if provided
      if (req.query.startDate && req.query.endDate) {
        query.createdAt = {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate),
        };
      }

      // Search by tracking number if provided
      if (req.query.tracking) {
        query.trackingNumber = { $regex: req.query.tracking, $options: "i" };
      }
    }

    const orders = await Order.find(query, null, options)
      .populate("user", "name email")
      .lean();

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      count: orders.length,
      total,
      data: orders,
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Get a single order
 */
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email")
      .populate("items.product", "name price image")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if the order belongs to the user or if user is admin
    if (
      order.user &&
      order.user._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "super-admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this order",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Update order status
 */
export const updateOrder = async (req, res) => {
  try {
    const {
      status,
      trackingNumber,
      notes,
      shippingMethod,
      isPaid,
      isDelivered,
    } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update fields if provided
    if (status) order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (notes) order.notes = notes;
    if (shippingMethod) order.shippingMethod = shippingMethod;

    // Update payment status
    if (isPaid !== undefined) {
      order.isPaid = isPaid;
      if (isPaid && !order.paidAt) {
        order.paidAt = Date.now();
      }
    }

    // Update delivery status
    if (isDelivered !== undefined) {
      order.isDelivered = isDelivered;
      if (isDelivered && !order.deliveredAt) {
        order.deliveredAt = Date.now();
      }
    }

    // If order is canceled, restore product quantity
    if (status === "Cancelled" && order.status !== "Cancelled") {
      // Restore quantities
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: item.quantity } },
          { new: true }
        );
      }
    }

    const updatedOrder = await order.save();

    res.json({
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Update order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Delete order (admin only)
 */
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    await Order.deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      message: "Order removed",
    });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Get order statistics
 */
export const getOrderStats = async (req, res) => {
  try {
    // Total orders
    const totalOrders = await Order.countDocuments();

    // Total revenue (from completed and delivered orders)
    const revenueResult = await Order.aggregate([
      {
        $match: {
          status: { $in: ["Completed", "Delivered"] },
          isPaid: true,
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
        },
      },
    ]);

    const totalRevenue =
      revenueResult.length > 0 ? revenueResult[0].revenue : 0;

    // Orders by status
    const ordersByStatus = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "name email")
      .lean();

    // Monthly sales for the current year
    const currentYear = new Date().getFullYear();
    const monthlySales = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`),
          },
          isPaid: true,
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          sales: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        ordersByStatus,
        recentOrders,
        monthlySales,
      },
    });
  } catch (error) {
    console.error("Order stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
