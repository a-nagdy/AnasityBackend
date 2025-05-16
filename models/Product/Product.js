import mongoose from "mongoose";
import { determineProductStatus } from "../../utils/productStatus.js";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "A product must have a name"],
      trim: true,
      maxlength: [100, "A product name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      lowercase: true,
      unique: true,
    },
    description: {
      type: String,
      required: [true, "A product must have a description"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    price: {
      type: Number,
      required: [true, "A product must have a price"],
      min: [0, "Price must be positive"],
    },
    discountPrice: {
      type: Number,
      min: [0, "Discount price must be positive"],
    },
    status: {
      type: String,
      enum: ["in stock", "out of stock", "draft", "low stock"],
      default: "in stock",
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "A product must belong to a category"],
    },
    quantity: {
      type: Number,
      required: [true, "A product must have a quantity"],
      min: [0, "Quantity must be positive"],
    },
    sold: {
      type: Number,
      default: 0,
    },
    images: [String],
    shipping: {
      type: Boolean,
      default: true,
    },
    color: [String],
    size: [String],
    ratings: [
      {
        star: Number,
        comment: String,
        postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    totalRating: {
      type: Number,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for better search performance
productSchema.index({ name: "text", description: "text" });

// Pre-save hook to automatically update status based on quantity and active state
productSchema.pre("save", function (next) {
  // Only update status if quantity or active state has changed
  if (this.isModified("quantity") || this.isModified("active")) {
    this.status = determineProductStatus(this.quantity, this.active);
  }
  next();
});

const Product = mongoose.model("Product", productSchema);

export default Product;
