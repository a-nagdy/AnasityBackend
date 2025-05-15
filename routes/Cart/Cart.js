import express from "express";
import {
  addItemToCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../../controllers/Cart/Cart.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

// All cart routes require authentication
router.use(protect);

// Get current user's cart
router.get("/", getCart);

// Add item to cart
router.post("/add", addItemToCart);

// Update cart item
router.put("/update", updateCartItem);

// Remove item from cart
router.delete("/item/:itemId", removeCartItem);

// Clear cart
router.delete("/clear", clearCart);

export default router;
