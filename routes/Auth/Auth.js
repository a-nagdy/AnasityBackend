import express from "express";
import {
  changePassword,
  getCurrentUser,
  login,
  register,
  updateProfile,
} from "../../controllers/Auth/Auth.js";
import { protect, roleCheck } from "../../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/register", roleCheck, register);
router.post("/login", login);

// Protected routes
router.get("/me", protect, getCurrentUser);
router.put("/update-profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;
