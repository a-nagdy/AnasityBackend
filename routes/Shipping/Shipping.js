import express from "express";
import {
  calculateShipping,
  getShippingOptions,
} from "../../controllers/Shipping/Shipping.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

// Get all shipping options
router.get("/options", getShippingOptions);

// Calculate shipping cost (needs authentication)
router.post("/calculate", protect, calculateShipping);

export default router;
