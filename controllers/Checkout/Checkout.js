import mongoose from "mongoose";
// import Stripe from "stripe";
import Address from "../../models/Address/Address.js";
import Cart from "../../models/Cart/Cart.js";
import Order from "../../models/Order/Order.js";
import Product from "../../models/Product/Product.js";
import paymob from "../../utils/paymob.js";

// Initialize Stripe with proper API key
// Make sure STRIPE_SECRET_KEY is properly set in your .env file (starts with sk_test_ or sk_live_)
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
//   apiVersion: "2023-10-16", // Use a stable API version
// });

// Create a new order
const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      guestCartId,
      shippingAddress,
      paymentMethod,
      addressId,
      shippingPrice = 0,
      taxPrice = 0,
    } = req.body;

    // Check if user is authenticated or if guestCartId is provided
    if (!req.user && !guestCartId) {
      return res.status(400).json({
        message: "Authentication or guestCartId is required",
        field: "authentication",
      });
    }

    // Get the shipping address
    let finalShippingAddress = shippingAddress;

    // If addressId is provided, use that address
    if (req.user && addressId) {
      const savedAddress = await Address.findOne({
        _id: addressId,
        user: req.user.id,
      });

      if (!savedAddress) {
        return res.status(404).json({
          message: "Address not found",
          field: "addressId",
        });
      }

      finalShippingAddress = {
        name: savedAddress.name,
        address: savedAddress.addressLine1,
        address2: savedAddress.addressLine2 || "",
        city: savedAddress.city,
        state: savedAddress.state,
        postalCode: savedAddress.postalCode,
        country: savedAddress.country,
        phone: savedAddress.phone,
      };
    }
    // If no specific address is provided, try to find the default shipping address
    else if (req.user && !shippingAddress) {
      const defaultAddress = await Address.findOne({
        user: req.user.id,
        isDefault: true,
        $or: [{ type: "shipping" }, { type: "both" }],
      });

      if (defaultAddress) {
        finalShippingAddress = {
          name: defaultAddress.name,
          address: defaultAddress.addressLine1,
          address2: defaultAddress.addressLine2 || "",
          city: defaultAddress.city,
          state: defaultAddress.state,
          postalCode: defaultAddress.postalCode,
          country: defaultAddress.country,
          phone: defaultAddress.phone,
        };
      }
    }

    // Validate that we have a shipping address
    if (
      !finalShippingAddress ||
      !finalShippingAddress.name ||
      !finalShippingAddress.address ||
      !finalShippingAddress.city ||
      !finalShippingAddress.state ||
      !finalShippingAddress.postalCode ||
      !finalShippingAddress.country ||
      !finalShippingAddress.phone
    ) {
      return res.status(400).json({
        message: "Complete shipping address is required",
        field: "shippingAddress",
      });
    }

    let cart;
    let finalOrderItems = [];

    // Get cart based on user authentication status
    if (req.user) {
      // Get authenticated user's cart
      cart = await Cart.findOne({ user: req.user.id }).populate({
        path: "items.product",
        select: "name price images quantity",
      });

      if (!cart || !cart.items || cart.items.length === 0) {
        return res.status(400).json({
          message: "Your cart is empty",
          field: "cart",
        });
      }
    } else {
      // Get guest cart
      // Note: You need to implement a guest cart model and logic
      return res.status(501).json({
        message: "Guest cart functionality not implemented yet",
        field: "guestCartId",
      });
    }

    // Transform cart items to order items format
    finalOrderItems = cart.items.map((item) => ({
      product: item.product._id,
      quantity: item.quantity,
      color: item.color,
      size: item.size,
    }));

    // Validate payment method
    if (!paymentMethod) {
      return res.status(400).json({
        message: "Payment method is required",
        field: "paymentMethod",
      });
    }

    // Calculate prices
    let itemsPrice = 0;
    const populatedOrderItems = [];

    // Fetch products and calculate prices
    for (const item of finalOrderItems) {
      const product = await Product.findById(item.product);

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          message: `Product with ID ${item.product} not found`,
          field: "orderItems",
        });
      }

      // Check if there's enough stock
      if (product.quantity < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: `Not enough stock for ${product.name}. Available: ${product.quantity}`,
          product: product._id,
          available: product.quantity,
        });
      }

      // Add to items price
      itemsPrice += product.price * item.quantity;

      // Prepare order item with product details
      populatedOrderItems.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        image:
          product.image ||
          (product.images && product.images.length > 0
            ? product.images[0]
            : null),
        color: item.color || null,
        size: item.size || null,
      });

      // We'll only update inventory after payment is confirmed
      // So we're not reducing stock at this stage
    }

    // Calculate total price
    const totalPrice = itemsPrice + shippingPrice + taxPrice;

    // Create the order with draft status - it will only become active after payment
    const order = await Order.create(
      [
        {
          user: req.user ? req.user.id : null,
          items: populatedOrderItems,
          shippingAddress: finalShippingAddress,
          paymentMethod,
          itemsPrice,
          shippingPrice,
          taxPrice,
          total: totalPrice,
          status: "Initialized", // Initial status before payment
        },
      ],
      { session }
    );

    // Note: We'll only clear the cart after successful payment
    // But we won't do that here yet

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message:
        "Order created successfully. Please complete payment to confirm.",
      order: order[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(500).json({ message: error.message });
  }
};

// Create Paymob payment intention
const createPaymentIntent = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  try {
    const order = await Order.findById(orderId).populate({
      path: "items.product",
      select: "name price description",
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if order belongs to user
    if (order.user && order.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to access this order" });
    }

    // Get user information for billing data (needed for email)
    let userEmail = null;
    if (req.user) {
      const user = await mongoose
        .model("User")
        .findById(req.user.id)
        .select("email");
      userEmail = user?.email;
    }

    // Collect shipping address and user info
    const addressData = {
      ...order.shippingAddress,
      email: userEmail || order.shippingAddress.email || "customer@example.com",
    };

    // Use the formatBillingData utility for consistent formatting
    const billingData = paymob.formatBillingData(addressData);

    // Format items for Paymob
    const items = order.items.map((item) => ({
      name: item.name || item.product?.name || "Product",
      price: Math.round((item.price || item.product?.price || 0) * 100), // Convert to cents
      description: item.product?.description || item.name || "Product",
      quantity: item.quantity,
    }));

    // Calculate the total in cents for verification
    const itemsTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const totalInCents = Math.round(order.total * 100); // Convert to cents

    // Add shipping and tax if they don't match (this ensures item prices + shipping + tax = total)
    const shippingAndTaxInCents = Math.round(
      (order.shippingPrice + order.taxPrice) * 100
    );

    // Update order status to Pending since payment is being initiated
    order.status = "Pending";
    await order.save();

    // Create payment intention with Paymob
    try {
      const paymentIntent = await paymob.createPaymentIntention({
        amount: totalInCents,
        currency: "EGP",
        integration_id: 5090280, // Using the mobile wallet integration
        billingData,
        items,
        orderId: order._id.toString(),
        userId: req.user ? req.user.id : "guest",
        // Include shipping and tax if needed
        shipping: Math.round(order.shippingPrice * 100),
        tax: Math.round(order.taxPrice * 100),
      });

      // Generate checkout URL
      const checkoutUrl = paymob.generateCheckoutUrl(
        paymentIntent.client_secret
      );

      res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        intentionId: paymentIntent.id,
        checkoutUrl,
      });
    } catch (paymobError) {
      console.error("Paymob API Error:", paymobError);

      // Since we already updated the order status to Pending, revert it back
      order.status = "Initialized";
      await order.save();

      return res.status(400).json({
        message: "Payment processing error",
        error:
          paymobError.message ||
          paymobError.hint ||
          "Failed to create payment intention",
      });
    }
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Confirm payment success from Paymob
const confirmPayment = async (req, res) => {
  const { orderId, transactionId, callbackData } = req.body;

  if (!orderId) {
    return res.status(400).json({
      message: "Order ID is required",
    });
  }

  try {
    // Process the callback data from Paymob
    const paymentResult = paymob.processPaymentCallback(callbackData);

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the order
      const order = await Order.findById(orderId).session(session);

      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if order belongs to user
      if (order.user && order.user.toString() !== req.user.id) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(403)
          .json({ message: "Not authorized to access this order" });
      }

      // If order is already paid, avoid duplicate processing
      if (order.isPaid) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Order is already paid" });
      }

      // If transaction was successful
      if (paymentResult.status === "confirmed") {
        // Update order status
        order.isPaid = true;
        order.paidAt = Date.now();
        order.status = "Processing";
        order.paymentResult = {
          id: transactionId || paymentResult.id,
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

        // Return the updated order
        res.status(200).json({
          message: "Payment confirmed successfully",
          order,
        });
      } else {
        // Payment was not successful
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "Payment not successful",
          status: paymentResult.status,
        });
      }
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error; // Re-throw to be caught by outer try/catch
    }
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Handle payment redirect from Paymob
const handlePaymentRedirect = async (req, res) => {
  try {
    // Extract order ID and status from query parameters
    const { id, success, orderId } = req.query;

    // If there's no order ID or transaction ID, redirect to an error page
    if (!orderId && !id) {
      return res.redirect("/payment-failed"); // Adjust this URL as needed
    }

    if (success === "true") {
      // Handle successful payment
      // Note: The actual payment confirmation happens in the webhook
      // This is just for redirecting the user to a success page

      // Find the order to get more details if needed
      const order = await Order.findById(orderId || id.split("_").pop());

      if (order) {
        // Redirect to success page with order ID
        return res.redirect(`/payment-success?orderId=${order._id}`);
      } else {
        // Could not find order
        return res.redirect("/payment-failed");
      }
    } else {
      // Handle failed payment
      return res.redirect("/payment-failed");
    }
  } catch (error) {
    console.error("Payment Redirect Error:", error);
    res.redirect("/payment-failed");
  }
};

export {
  confirmPayment,
  createOrder,
  createPaymentIntent,
  handlePaymentRedirect,
};
