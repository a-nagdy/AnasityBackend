import mongoose from "mongoose";
import Category from "../../models/Category/Category.js";

// Get all categories
const getAllCategories = async (req, res) => {
  try {
    // Find only root categories (no parent)
    const categories = await Category.find({ parent: null })
      .populate("children")
      .sort({ createdAt: -1 });

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get category by ID
const getCategoryById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid category ID format" });
  }

  try {
    const category = await Category.findById(id).populate("children");

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new category
const createCategory = async (req, res) => {
  try {
    // Create slug from name if not provided
    if (!req.body.slug && req.body.name) {
      req.body.slug = req.body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    // Validate parent ID if provided
    if (req.body.parent) {
      if (!mongoose.Types.ObjectId.isValid(req.body.parent)) {
        return res
          .status(400)
          .json({ message: "Invalid parent category ID format" });
      }

      const parentExists = await Category.findById(req.body.parent);
      if (!parentExists) {
        return res.status(400).json({ message: "Parent category not found" });
      }
    }

    const category = await Category.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = {};

      Object.keys(error.errors).forEach((field) => {
        errors[field] = error.errors[field].message;
      });

      return res.status(400).json({
        message: "Validation error",
        errors: errors,
      });
    }

    // Handle duplicate key errors (unique fields)
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Duplicate value error",
        field: Object.keys(error.keyPattern)[0],
        value: error.keyValue[Object.keys(error.keyPattern)[0]],
      });
    }

    res.status(500).json({ message: error.message });
  }
};

// Update a category
const updateCategory = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid category ID format" });
  }

  try {
    // Handle slug update if name is changed but slug isn't provided
    if (req.body.name && !req.body.slug) {
      req.body.slug = req.body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    // Prevent setting itself as parent
    if (req.body.parent === id) {
      return res
        .status(400)
        .json({ message: "Category cannot be its own parent" });
    }

    // Validate parent ID if provided
    if (req.body.parent) {
      if (!mongoose.Types.ObjectId.isValid(req.body.parent)) {
        return res
          .status(400)
          .json({ message: "Invalid parent category ID format" });
      }

      const parentExists = await Category.findById(req.body.parent);
      if (!parentExists) {
        return res.status(400).json({ message: "Parent category not found" });
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(updatedCategory);
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = {};

      Object.keys(error.errors).forEach((field) => {
        errors[field] = error.errors[field].message;
      });

      return res.status(400).json({
        message: "Validation error",
        errors: errors,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Duplicate value error",
        field: Object.keys(error.keyPattern)[0],
        value: error.keyValue[Object.keys(error.keyPattern)[0]],
      });
    }

    res.status(500).json({ message: error.message });
  }
};

// Delete a category
const deleteCategory = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid category ID format" });
  }

  try {
    // Check if category has children
    const hasChildren = await Category.exists({ parent: id });
    if (hasChildren) {
      return res.status(400).json({
        message:
          "Cannot delete category with subcategories. Remove or reassign subcategories first.",
      });
    }

    // Check if category has products (assuming products reference categories)
    // This would need to be implemented based on your Product model

    const deletedCategory = await Category.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
};
