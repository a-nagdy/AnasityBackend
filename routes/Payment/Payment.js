import express from "express";
import {
  getPaymentMethods,
  initializePayment,
  paymentWebhook,
} from "../../controllers/Payment/Payment.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

// Get all payment methods (public)
router.get("/methods", getPaymentMethods);

// Initialize payment (requires auth)
router.post("/initialize", protect, initializePayment);

// Payment webhook (for Paymob, PayPal callbacks)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentWebhook
);

export default router;
