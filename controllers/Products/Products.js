import mongoose from "mongoose";
import Product from "../../models/Product/Product.js";
import { deleteFile, uploadFile } from "../../utils/fileUpload.js";

// Get all products
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("category", "name");

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }

  try {
    const product = await Product.findById(id).populate("category", "name");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const productData = { ...req.body };

    // Create a slug if not provided
    if (!productData.slug && productData.name) {
      productData.slug = productData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    // Validate category ID if provided
    if (productData.category) {
      if (!mongoose.Types.ObjectId.isValid(productData.category)) {
        return res.status(400).json({ message: "Invalid category ID format" });
      }
    }

    // Handle image upload if exists
    if (req.files && req.files.image) {
      try {
        const imagePath = await uploadFile(req.files.image, "products");
        productData.image = imagePath;
      } catch (uploadError) {
        return res.status(400).json({ message: uploadError.message });
      }
    }

    // Handle multiple images if they exist
    if (req.files && req.files.images) {
      try {
        const imageFiles = Array.isArray(req.files.images)
          ? req.files.images
          : [req.files.images];

        const uploadedPaths = await Promise.all(
          imageFiles.map((file) => uploadFile(file, "products"))
        );

        productData.images = uploadedPaths;

        // If main image is missing but we have images, use the first one
        if (!productData.image && uploadedPaths.length > 0) {
          productData.image = uploadedPaths[0];
        }
      } catch (uploadError) {
        return res.status(400).json({ message: uploadError.message });
      }
    }

    // Parse JSON strings if they exist
    if (typeof productData.color === "string") {
      try {
        productData.color = JSON.parse(productData.color);
      } catch (e) {
        // If it's not valid JSON, treat it as a single value
        productData.color = [productData.color];
      }
    }

    if (typeof productData.size === "string") {
      try {
        productData.size = JSON.parse(productData.size);
      } catch (e) {
        // If it's not valid JSON, treat it as a single value
        productData.size = [productData.size];
      }
    }

    // Create a new product with all fields from the request body
    const product = await Product.create(productData);
    res.status(201).json(product);
  } catch (error) {
    // If the error is a ValidationError from Mongoose
    if (error.name === "ValidationError") {
      const errors = {};

      // Extract all validation errors
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

    // For other types of errors
    res.status(500).json({ message: error.message });
  }
};

// Update product
const updateProduct = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }

  try {
    // Find the product to update
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updateData = { ...req.body };

    // Handle slug update if name is changed but slug isn't provided
    if (updateData.name && !updateData.slug) {
      updateData.slug = updateData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    // Validate category ID if provided
    if (
      updateData.category &&
      !mongoose.Types.ObjectId.isValid(updateData.category)
    ) {
      return res.status(400).json({ message: "Invalid category ID format" });
    }

    // Handle image upload if exists
    if (req.files && req.files.image) {
      try {
        // Delete old image if it exists
        if (product.image) {
          await deleteFile(product.image);
        }

        const imagePath = await uploadFile(req.files.image, "products");
        updateData.image = imagePath;
      } catch (uploadError) {
        return res.status(400).json({ message: uploadError.message });
      }
    }

    // Handle image removal if specified
    if (updateData.removeImages) {
      const imagesToRemove =
        typeof updateData.removeImages === "string"
          ? [updateData.removeImages]
          : updateData.removeImages;

      // Delete the files
      for (const imgPath of imagesToRemove) {
        await deleteFile(imgPath);
      }

      // Update images array
      if (product.images && product.images.length > 0) {
        updateData.images = product.images.filter(
          (img) => !imagesToRemove.includes(img)
        );
      }

      // Delete this field so it doesn't get saved to DB
      delete updateData.removeImages;
    }

    // Handle new additional images
    if (req.files && req.files.images) {
      try {
        const imageFiles = Array.isArray(req.files.images)
          ? req.files.images
          : [req.files.images];

        const uploadedPaths = await Promise.all(
          imageFiles.map((file) => uploadFile(file, "products"))
        );

        // Combine with existing images if not explicitly removed
        updateData.images = [
          ...(updateData.images || product.images || []),
          ...uploadedPaths,
        ];

        // If main image is missing but we have images, use the first one
        if (
          !updateData.image &&
          !product.image &&
          updateData.images.length > 0
        ) {
          updateData.image = updateData.images[0];
        }
      } catch (uploadError) {
        return res.status(400).json({ message: uploadError.message });
      }
    }

    // Parse JSON strings if they exist
    if (typeof updateData.color === "string") {
      try {
        updateData.color = JSON.parse(updateData.color);
      } catch (e) {
        updateData.color = [updateData.color];
      }
    }

    if (typeof updateData.size === "string") {
      try {
        updateData.size = JSON.parse(updateData.size);
      } catch (e) {
        updateData.size = [updateData.size];
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json(updatedProduct);
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

// Delete product
const deleteProduct = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }

  try {
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete associated images
    if (product.image) {
      await deleteFile(product.image);
    }

    if (product.images && product.images.length > 0) {
      for (const imgPath of product.images) {
        await deleteFile(imgPath);
      }
    }

    // Delete the product
    await Product.findByIdAndDelete(id);

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  updateProduct,
};
