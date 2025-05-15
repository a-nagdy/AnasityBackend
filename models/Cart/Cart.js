import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity cannot be less than 1"],
  },
  color: String,
  size: String,
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
    totalPrice: {
      type: Number,
      default: 0,
    },
    totalItems: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate totals before saving
cartSchema.pre("save", async function (next) {
  try {
    let totalPrice = 0;
    let totalItems = 0;

    // Populate products to get their current prices
    const populatedCart = await mongoose
      .model("Cart")
      .findById(this._id)
      .populate("items.product");

    if (populatedCart) {
      for (const item of populatedCart.items) {
        if (item.product) {
          totalPrice += item.product.price * item.quantity;
          totalItems += item.quantity;
        }
      }
    } else {
      // For new carts, we can't populate yet
      this.totalItems = this.items.reduce(
        (total, item) => total + item.quantity,
        0
      );
      // We'll need to update the price after creating via a separate call
    }

    this.totalPrice = totalPrice;
    this.totalItems = totalItems;

    next();
  } catch (error) {
    next(error);
  }
});

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;
