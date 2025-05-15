import express from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
} from "../../controllers/Categories/Categories.js";

const router = express.Router();

// GET all categories
router.get("/", getAllCategories);

// GET single category by ID
router.get("/:id", getCategoryById);

// POST create new category
router.post("/", createCategory);

// PUT update category
router.put("/:id", updateCategory);

// DELETE category
router.delete("/:id", deleteCategory);

export default router;
