import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },
    slug: {
      type: String,
      lowercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    image: {
      type: String,
    },
    imageId: {
      type: String, // Cloudinary public_id
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    strict: true,
  }
);

// Ensure no sequentialId is saved
categorySchema.pre("save", function (next) {
  if (this.sequentialId !== undefined) {
    delete this.sequentialId;
  }
  next();
});

// Virtual for child categories
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

// Index for better search performance
categorySchema.index({ name: "text" });

const Category = mongoose.model("Category", categorySchema);

export default Category;
