// import Stripe from "stripe";
import mongoose from "mongoose";
import Cart from "../../models/Cart/Cart.js";
import Order from "../../models/Order/Order.js";
import Product from "../../models/Product/Product.js";

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
    console.log("Webhook query params:", req.query);
    console.log("Webhook body:", req.body);

    // Simple PayMob success detection - checking multiple conditions
    const isPaymobSuccess =
      (req.query &&
        req.query.success === "true" &&
        req.query.is_voided === "false" &&
        req.query.is_refunded === "false") ||
      (req.query && req.query["data.message"] === "Approved") ||
      (req.body && req.body.obj && req.body.obj.success === true);

    // Attempt to extract the MongoDB order ID from PayMob's webhook data
    let orderId = null;

    // Look in req.body path where our orderId is stored by our checkout controller
    if (
      req.body &&
      req.body.obj &&
      req.body.obj.payment_key_claims &&
      req.body.obj.payment_key_claims.extra &&
      req.body.obj.payment_key_claims.extra.orderId
    ) {
      // This is our actual MongoDB order ID that we stored in the payment key
      orderId = req.body.obj.payment_key_claims.extra.orderId;
      console.log(`Found MongoDB orderId in payment data: ${orderId}`);
    }

    // If not found in extra data, look for direct URL parameter that might contain our order ID
    if (!orderId && req.query && req.query.merchant_order_id) {
      orderId = req.query.merchant_order_id;
    }

    // Final fallback to PayMob's internal order ID - not ideal but better than nothing
    if (!orderId) {
      orderId = req.query.order || req.query.id;
    }

    console.log(
      `PayMob webhook: success=${isPaymobSuccess}, orderId=${orderId}`
    );

    if (isPaymobSuccess && orderId) {
      try {
        console.log("Starting payment processing for order:", orderId);

        // DIRECT UPDATE APPROACH - No transaction
        // Find the order without a session
        const order = await Order.findById(orderId);

        if (!order) {
          console.error(`Order not found: ${orderId}`);
          return;
        }

        console.log(
          `Found order: ${order._id}, current status: ${order.status}, isPaid: ${order.isPaid}`
        );

        // If order is already paid, avoid duplicate processing
        if (order.isPaid) {
          console.log(`Order ${orderId} is already paid, skipping processing`);
          return;
        }

        // Update order payment status directly
        const paymentResult = {
          id: req.body?.obj?.id || req.query.id || orderId,
          status: "confirmed",
          update_time: new Date().toISOString(),
        };

        console.log("Updating order with payment info:", paymentResult);

        // Use findByIdAndUpdate for atomic update
        const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          {
            isPaid: true,
            paidAt: Date.now(),
            status: "Processing",
            paymentResult: paymentResult,
          },
          { new: true }
        );

        if (!updatedOrder) {
          console.error("Order update failed - order not found");
          return;
        }

        console.log(
          `Order ${orderId} updated successfully. Status: ${updatedOrder.status}, isPaid: ${updatedOrder.isPaid}`
        );

        // Update inventory for each product one by one
        for (const item of order.items) {
          try {
            console.log(
              `Updating inventory for product ${item.product}, quantity: ${item.quantity}`
            );

            const product = await Product.findById(item.product);
            if (product) {
              product.quantity = Math.max(0, product.quantity - item.quantity);
              product.sold = (product.sold || 0) + item.quantity;
              await product.save();
              console.log(
                `Product ${product._id} updated. New quantity: ${product.quantity}, sold: ${product.sold}`
              );
            } else {
              console.log(`Product not found: ${item.product}`);
            }
          } catch (productError) {
            console.error(
              `Error updating product ${item.product}:`,
              productError
            );
          }
        }

        // Clear the user's cart if they are logged in
        if (order.user) {
          try {
            console.log(`Attempting to clear cart for user: ${order.user}`);

            // Use deleteOne directly rather than findOneAndDelete
            const deleteResult = await Cart.deleteOne({ user: order.user });

            if (deleteResult && deleteResult.deletedCount > 0) {
              console.log(`Successfully deleted cart for user ${order.user}`);
            } else {
              console.log(`No cart found to delete for user ${order.user}`);

              // Double-check if the cart still exists
              const cartCheck = await Cart.findOne({ user: order.user });
              if (cartCheck) {
                console.log(
                  `Cart still exists for user ${order.user}, trying direct deletion`
                );
                // Force delete with native MongoDB driver as a fallback
                await mongoose.connection
                  .collection("carts")
                  .deleteOne({ user: mongoose.Types.ObjectId(order.user) });
                console.log(`Forced cart deletion for user ${order.user}`);
              }
            }
          } catch (cartError) {
            console.error(
              `Error removing cart for user ${order.user}:`,
              cartError
            );
          }
        }

        console.log(`Order ${orderId} fully processed and marked as paid`);
      } catch (error) {
        console.error("Error processing payment:", error);
      }
    } else if (orderId) {
      console.log(
        `PayMob payment failed or not successful for order: ${orderId}`
      );
      // For failed payments, simply log but don't update the order
    } else {
      console.log("PayMob webhook missing orderId or success parameters");
    }
  } catch (error) {
    console.error("Webhook Error:", error);
    // No need to send response here as we already sent 200 at the beginning
  }
};

export { getPaymentMethods, initializePayment, paymentWebhook };
