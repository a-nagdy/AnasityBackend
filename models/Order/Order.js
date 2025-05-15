import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Allow guest checkout
    },
    email: {
      type: String,
      required: function () {
        return !this.user; // Required only for guest checkout
      },
      trim: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        image: String,
        color: String,
        size: String,
      },
    ],
    shippingAddress: {
      name: { type: String, required: true },
      address: { type: String, required: true },
      address2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      phone: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["credit_card", "paypal", "paymob", "cash_on_delivery"],
    },
    paymentResult: {
      id: String,
      status: String,
      update_time: String,
      email_address: String,
    },
    itemsPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    taxPrice: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: [
        "Initialized", // Payment not yet attempted
        "Draft", // Order created but not confirmed
        "Pending", // Order confirmed but payment pending
        "Processing", // Payment received, processing order
        "Shipped",
        "Delivered",
        "Cancelled",
        "Completed",
      ],
      default: "Initialized",
    },
    shippingMethod: {
      type: String,
      enum: ["Standard", "Express", "Overnight"],
      default: "Standard",
    },
    trackingNumber: String,
    notes: String,
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: Date,
    isDelivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: Date,
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ "paymentResult.id": 1 });

// Calculate the total amount for the order
orderSchema.pre("save", function (next) {
  // If total is already set, don't recalculate
  if (this.total > 0) return next();

  this.total =
    this.itemsPrice + this.taxPrice + this.shippingPrice - this.discountAmount;
  next();
});

const Order = mongoose.model("Order", orderSchema);

export default Order;
