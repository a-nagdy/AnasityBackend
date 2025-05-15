import express from "express";
import {
  createAddress,
  deleteAddress,
  getAddressById,
  getAddresses,
  setDefaultAddress,
  updateAddress,
} from "../../controllers/Address/Address.js";
import { protect } from "../../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET all addresses for the authenticated user
router.get("/", getAddresses);

// GET a single address by ID
router.get("/:id", getAddressById);

// POST create a new address
router.post("/", createAddress);

// PUT update an address
router.put("/:id", updateAddress);

// DELETE an address
router.delete("/:id", deleteAddress);

// PATCH set address as default
router.patch("/:id/default", setDefaultAddress);

export default router;
