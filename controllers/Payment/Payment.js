// import Stripe from "stripe";
import mongoose from "mongoose";
import Cart from "../../models/Cart/Cart.js";
import Order from "../../models/Order/Order.js";
import Product from "../../models/Product/Product.js";
import paymob from "../../utils/paymob.js";

// Initialize Stripe
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Available payment methods
const paymentMethods = [
  {
    id: "credit_card",
    name: "Credit Card",
    description: "Pay with Visa, Mastercard, American Express, or Discover",
    processor: "paymob",
    icon: "credit-card",
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Pay with your PayPal account",
    processor: "paypal",
    icon: "paypal",
  },
  {
    id: "cash_on_delivery",
    name: "Cash on Delivery",
    description: "Pay when you receive your order",
    processor: "manual",
    icon: "money-bill",
  },
];

// Get all payment methods
const getPaymentMethods = async (req, res) => {
  try {
    res.status(200).json(paymentMethods);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Initialize a payment based on method
const initializePayment = async (req, res) => {
  try {
    const { paymentMethod, amount, currency = "egp", orderId } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        message: "Payment method is required",
        field: "paymentMethod",
      });
    }

    if (!amount) {
      return res.status(400).json({
        message: "Amount is required",
        field: "amount",
      });
    }

    // Validate payment method
    const selectedMethod = paymentMethods.find(
      (method) => method.id === paymentMethod
    );

    if (!selectedMethod) {
      return res.status(400).json({
        message: "Invalid payment method",
        field: "paymentMethod",
      });
    }

    // Process based on payment processor
    switch (selectedMethod.processor) {
      case "paymob":
        // For Paymob, we'll redirect to checkout controller which handles the full payment flow
        return res.status(200).json({
          processorType: "paymob",
          message:
            "Use checkout/payment-intent endpoint with order ID to proceed with payment",
          success: true,
        });

      case "stripe":
        // Stripe payment is disabled
        return res.status(400).json({
          message: "Stripe payments are currently disabled",
          field: "paymentMethod",
        });

      /* Commented out Stripe implementation
        // Create a Payment Intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Stripe requires cents
          currency,
          metadata: {
            orderId: orderId || "pending",
            paymentMethod: selectedMethod.id,
            userId: req.user.id,
          },
        });

        return res.status(200).json({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          processorType: "stripe",
        });
        */

      case "paypal":
        // This would typically integrate with PayPal API
        return res.status(200).json({
          redirectUrl: `https://www.sandbox.paypal.com/checkoutnow?token=sample-paypal-token-${Date.now()}`,
          processorType: "paypal",
        });

      case "manual":
        // No processing needed for manual methods like Cash on Delivery
        return res.status(200).json({
          message: "Manual payment method selected",
          processorType: "manual",
          success: true,
        });

      default:
        return res.status(400).json({
          message: "Unsupported payment processor",
          field: "paymentMethod",
        });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Webhook for payment provider callbacks
const paymentWebhook = async (req, res) => {
  // Always acknowledge receipt immediately regardless of processing outcome
  // This is important for payment providers to avoid retries
  res.status(200).json({ received: true });

  try {
    console.log("Webhook headers:", JSON.stringify(req.headers, null, 2));
    console.log("Webhook body:", JSON.stringify(req.body, null, 2));
    console.log("Webhook query:", JSON.stringify(req.query, null, 2));

    // Improved PayMob detection - check for multiple indicators
    const isPaymob =
      req.headers["x-paymob-signature"] ||
      (req.body && req.body.source && req.body.source === "paymob") ||
      (req.body && req.body.type === "TRANSACTION") ||
      (req.body && req.body.obj && req.body.obj.order) ||
      (req.query && req.query.success !== undefined && req.query.amount_cents);

    // Get data from either body or query parameters
    let paymentData = isPaymob
      ? Object.keys(req.query).length > 0
        ? req.query
        : req.body
      : req.body;

    // Log webhook receipt
    console.log(
      `Payment webhook received: ${isPaymob ? "Paymob" : "Unknown"} provider`
    );
    console.log(
      "Webhook data:",
      JSON.stringify(paymentData).substring(0, 500) +
        (JSON.stringify(paymentData).length > 500 ? "..." : "")
    );

    if (isPaymob) {
      // Handle Paymob webhook
      const callbackData = paymentData;
      let orderId, isSuccessful;

      // Extract order ID from different possible locations
      if (
        callbackData.obj &&
        callbackData.obj.order &&
        callbackData.obj.order.id
      ) {
        // New format from PayMob
        orderId = callbackData.obj.order.id.toString();
        isSuccessful =
          callbackData.obj.success === true &&
          callbackData.obj.is_voided !== true &&
          callbackData.obj.is_refunded !== true;

        console.log(
          `Found order ID in obj.order.id: ${orderId}, success: ${isSuccessful}`
        );
      } else {
        // Extract order ID directly from query parameter or other locations
        orderId = callbackData.id || callbackData.order;

        // Process the payment result from Paymob utility
        const paymentResult = paymob.processPaymentCallback(callbackData);

        // Fallback to orderId from paymentResult if available
        if (!orderId && paymentResult && paymentResult.orderId) {
          orderId = paymentResult.orderId;
        }

        // Check if payment is successful based on query parameters or processed result
        isSuccessful =
          (callbackData.success === "true" || callbackData.success === true) &&
          (callbackData.is_void === "false" ||
            callbackData.is_void === false) &&
          (callbackData.error_occured === "false" ||
            callbackData.error_occured === false);

        if (paymentResult && paymentResult.status === "confirmed") {
          isSuccessful = true;
        }
      }

      console.log(
        `Processing payment for order: ${orderId}, isSuccessful: ${isSuccessful}`
      );

      if (!orderId) {
        console.error("No order ID found in Paymob webhook data");
        return; // Already sent 200 response
      }

      if (orderId && isSuccessful) {
        // Start a session for transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Find the order
          const order = await Order.findById(orderId).session(session);

          if (!order) {
            // Try to find by other formats - PayMob might send order ID in a different format
            const alternativeOrder = await Order.findOne({
              $or: [
                { "paymentResult.id": orderId },
                { "paymentResult.id": orderId.toString() },
              ],
            }).session(session);

            if (!alternativeOrder) {
              await session.abortTransaction();
              session.endSession();
              console.error(`Order not found: ${orderId}`);
              return; // Already sent 200 response
            }

            console.log(
              `Found order using alternative search: ${alternativeOrder._id}`
            );
            order = alternativeOrder;
          }

          // If order is already paid, avoid duplicate processing
          if (order.isPaid) {
            await session.abortTransaction();
            session.endSession();
            console.log(
              `Order ${orderId} is already paid, skipping processing`
            );
            return; // Already sent 200 response
          }

          // Update order payment status
          order.isPaid = true;
          order.paidAt = Date.now();
          order.status = "Processing";
          order.paymentResult = {
            id: orderId,
            status: "confirmed",
            update_time: new Date().toISOString(),
          };

          // Save the order
          await order.save({ session });

          console.log(`Order ${orderId} updated with payment info`);

          // Now update inventory for each product
          for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
              console.log(
                `Updating product ${product._id}: Quantity: ${product.quantity} - ${item.quantity}, Sold: ${product.sold} + ${item.quantity}`
              );

              product.quantity = Math.max(0, product.quantity - item.quantity);
              product.sold = (product.sold || 0) + item.quantity;

              await product.save({ session });
            } else {
              console.warn(`Product not found: ${item.product}`);
            }
          }

          // Clear the user's cart if they are logged in
          if (order.user) {
            await Cart.findOneAndDelete({ user: order.user }, { session });
          }

          // Commit the transaction
          await session.commitTransaction();
          session.endSession();

          console.log(
            `Order ${orderId} has been successfully processed and marked as paid`
          );
        } catch (error) {
          // If any error occurs, abort the transaction
          await session.abortTransaction();
          session.endSession();
          console.error("Error processing payment success:", error);
        }
      } else if (orderId && !isSuccessful) {
        // Handle failed/refunded payments
        console.log(
          `Order ${orderId} payment failed or refunded, updating status`
        );

        try {
          // Update order status without transaction since we're not modifying inventory
          const order = await Order.findById(orderId);
          if (order) {
            let statusUpdate = "Cancelled";

            if (callbackData.obj && callbackData.obj.is_refunded === true)
              statusUpdate = "Refunded";
            else if (callbackData.is_refunded === true)
              statusUpdate = "Refunded";

            order.status = statusUpdate;
            order.paymentResult = {
              id: orderId,
              status: "failed",
              update_time: new Date().toISOString(),
            };

            await order.save();
            console.log(`Order ${orderId} status updated to ${order.status}`);
          } else {
            console.error(`Order not found: ${orderId}`);
          }
        } catch (error) {
          console.error(`Error updating order ${orderId} status:`, error);
        }
      }
    } else {
      // Log unknown payment provider
      console.warn(
        "Unsupported payment provider webhook received:",
        req.headers
      );
    }
  } catch (error) {
    console.error("Webhook Error:", error);
    // No need to send response here as we already sent 200 at the beginning
  }
};

export { getPaymentMethods, initializePayment, paymentWebhook };
