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
    // Determine payment processor based on headers or payload
    const isPaymob =
      req.headers["x-paymob-signature"] ||
      (req.body && req.body.source && req.body.source === "paymob");

    // Log webhook receipt
    console.log(
      `Payment webhook received: ${isPaymob ? "Paymob" : "Unknown"} provider`
    );
    console.log(
      "Webhook data:",
      JSON.stringify(req.body).substring(0, 500) +
        (JSON.stringify(req.body).length > 500 ? "..." : "")
    );

    if (isPaymob) {
      // Handle Paymob webhook
      const callbackData = req.body;

      // Process the payment result from Paymob
      const paymentResult = paymob.processPaymentCallback(callbackData);

      // Get the order ID from extras
      const orderId = paymentResult.orderId;

      if (!orderId) {
        console.error("No order ID found in Paymob webhook data");
        return; // Already sent 200 response
      }

      if (orderId && paymentResult.status === "confirmed") {
        // Start a session for transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Find the order
          const order = await Order.findById(orderId).session(session);

          if (!order) {
            await session.abortTransaction();
            session.endSession();
            console.error(`Order not found: ${orderId}`);
            return; // Already sent 200 response
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
            id: paymentResult.id,
            status: paymentResult.status,
            update_time: paymentResult.update_time,
          };

          // Save the order
          await order.save({ session });

          // Now update inventory for each product
          for (const item of order.items) {
            await Product.findByIdAndUpdate(
              item.product,
              {
                $inc: {
                  quantity: -item.quantity,
                  sold: item.quantity,
                },
              },
              { session }
            );
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
      } else if (
        orderId &&
        ["failed", "refunded", "voided"].includes(paymentResult.status)
      ) {
        // Handle failed/refunded payments
        console.log(
          `Order ${orderId} payment ${paymentResult.status}, updating status`
        );

        try {
          // Update order status without transaction since we're not modifying inventory
          const order = await Order.findById(orderId);
          if (order) {
            order.status =
              paymentResult.status === "refunded"
                ? "Refunded"
                : order.status === "Initialized"
                ? "Cancelled"
                : order.status;

            order.paymentResult = {
              id: paymentResult.id,
              status: paymentResult.status,
              update_time: paymentResult.update_time,
            };

            await order.save();
            console.log(`Order ${orderId} status updated to ${order.status}`);
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
