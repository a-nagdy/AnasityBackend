import jwt from "jsonwebtoken";
import User from "../models/User/User.js";

// Protect routes - Handles both API token auth and admin cookie auth
export const protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in cookie (for admin panel)
    if (req.cookies && req.cookies.adminToken) {
      token = req.cookies.adminToken;
    }
    // Check for token in headers (for API)
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // If no token found
    if (!token) {
      // For API routes, return JSON response
      if (req.originalUrl.startsWith("/api")) {
        return res.status(401).json({
          success: false,
          message: "Not authorized, no token",
        });
      }
      // For admin routes, redirect to login page
      else if (req.originalUrl.startsWith("/admin")) {
        return res.redirect("/admin/login");
      }
      // For other routes, return 401
      else {
        return res.status(401).json({
          success: false,
          message: "Not authorized, no token",
        });
      }
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      // Clear any invalid cookies
      if (req.cookies.adminToken) {
        res.clearCookie("adminToken");
      }

      // For API routes, return JSON response
      if (req.originalUrl.startsWith("/api")) {
        return res.status(401).json({
          success: false,
          message: "Not authorized, user not found",
        });
      }
      // For admin routes, redirect to login page
      else if (req.originalUrl.startsWith("/admin")) {
        return res.redirect("/admin/login");
      }
      // For other routes, return 401
      else {
        return res.status(401).json({
          success: false,
          message: "Not authorized, user not found",
        });
      }
    }

    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    // Clear any invalid cookies
    if (req.cookies.adminToken) {
      res.clearCookie("adminToken");
    }

    // For API routes, return JSON response
    if (req.originalUrl.startsWith("/api")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token failed",
      });
    }
    // For admin routes, redirect to login page
    else if (req.originalUrl.startsWith("/admin")) {
      return res.redirect("/admin/login");
    }
    // For other routes, return 401
    else {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token failed",
      });
    }
  }
};

// Admin only middleware
export const adminOnly = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === "admin" || req.user.role === "super-admin")
  ) {
    next();
  } else {
    // For API routes, return JSON response
    if (req.originalUrl.startsWith("/api")) {
      return res.status(403).json({
        success: false,
        message: "Not authorized as an admin",
      });
    }
    // For admin routes, redirect to login page
    else if (req.originalUrl.startsWith("/admin")) {
      return res.redirect("/admin/login?error=Admin access required");
    }
    // For other routes, return 403
    else {
      return res.status(403).json({
        success: false,
        message: "Not authorized as an admin",
      });
    }
  }
};

// Super admin only middleware
export const superAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "super-admin") {
    return res.status(403).json({
      message: "Access denied. Super admin privileges required.",
    });
  }

  next();
};

// Role verification middleware for user registration
export const roleCheck = async (req, res, next) => {
  // If role isn't specified or is 'customer', proceed
  if (!req.body.role || req.body.role === "customer") {
    return next();
  }

  // If trying to create an admin or super-admin account
  if (req.body.role === "admin" || req.body.role === "super-admin") {
    // If no auth header, deny access
    if (!req.headers.authorization) {
      return res.status(403).json({
        message: "Not authorized to create admin accounts",
        field: "role",
      });
    }

    try {
      // Extract and verify token
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-fallback-secret-key"
      );

      // Find the user making the request
      const adminUser = await User.findById(decoded.id);

      // Check if user exists and is a super-admin
      if (!adminUser || adminUser.role !== "super-admin") {
        return res.status(403).json({
          message: "Only super-admin can create admin accounts",
          field: "role",
        });
      }

      // Super-admin can create both admin and super-admin accounts
      next();
    } catch (error) {
      return res.status(401).json({
        message: "Invalid or expired token",
        field: "authorization",
      });
    }
  } else {
    // If role is neither 'customer', 'admin', nor 'super-admin'
    return res.status(400).json({
      message: "Invalid role specified",
      field: "role",
    });
  }
};
