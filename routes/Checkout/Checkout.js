import express from "express";
import {
  confirmPayment,
  createOrder,
  createPaymentIntent,
  handlePaymentRedirect,
} from "../../controllers/Checkout/Checkout.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

// All checkout routes require authentication except for payment redirect
router.use(["/order", "/payment-intent", "/confirm-payment"], protect);

// Create order
router.post("/order", createOrder);

// Create payment intent
router.post("/payment-intent", createPaymentIntent);

// Confirm payment
router.post("/confirm-payment", confirmPayment);

// Handle payment redirect (public route, doesn't require auth)
router.get("/payment-redirect", handlePaymentRedirect);

export default router;
