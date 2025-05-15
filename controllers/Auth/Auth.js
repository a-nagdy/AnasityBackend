import jwt from "jsonwebtoken";
import User from "../../models/User/User.js";

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || "your-fallback-secret-key",
    { expiresIn: "7d" }
  );
};

// Register a new user
const register = async (req, res) => {
  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already in use",
        field: "email",
      });
    }

    // Create new user
    const user = await User.create(req.body);

    // Generate token
    const token = generateToken(user._id, user.role);

    // Set last login
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      token,
      user,
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = {};

      Object.keys(error.errors).forEach((field) => {
        errors[field] = error.errors[field].message;
      });

      return res.status(400).json({
        message: "Validation error",
        errors,
      });
    }

    res.status(500).json({ message: error.message });
  }
};

// Create admin user (super-admin only)
const createAdmin = async (req, res) => {
  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already in use",
        field: "email",
      });
    }

    // Force the role to be admin if not specified
    if (!req.body.role) {
      req.body.role = "admin";
    }

    // Validate the role is either admin or super-admin
    if (req.body.role !== "admin" && req.body.role !== "super-admin") {
      return res.status(400).json({
        message: "Invalid role specified",
        field: "role",
      });
    }

    // If trying to create a super-admin, ensure the creator is also a super-admin
    if (req.body.role === "super-admin" && req.user.role !== "super-admin") {
      return res.status(403).json({
        message: "Only super-admin can create super-admin accounts",
        field: "role",
      });
    }

    // Create admin user
    const adminUser = await User.create(req.body);

    res.status(201).json({
      message: `${
        req.body.role === "super-admin" ? "Super admin" : "Admin"
      } user created successfully`,
      user: adminUser,
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = {};

      Object.keys(error.errors).forEach((field) => {
        errors[field] = error.errors[field].message;
      });

      return res.status(400).json({
        message: "Validation error",
        errors,
      });
    }

    res.status(500).json({ message: error.message });
  }
};

// Login user
const login = async (req, res) => {
  const { email, password } = req.body;

  // Validate email and password are provided
  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
      errors: {
        email: !email ? "Email is required" : null,
        password: !password ? "Password is required" : null,
      },
    });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
        field: "email",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        message: "Account has been deactivated. Please contact support.",
        field: "email",
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials",
        field: "password",
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get current user profile
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    // Don't allow password updates through this endpoint
    if (req.body.password) {
      delete req.body.password;
    }

    // Don't allow role updates through this endpoint
    if (req.body.role) {
      delete req.body.role;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = {};

      Object.keys(error.errors).forEach((field) => {
        errors[field] = error.errors[field].message;
      });

      return res.status(400).json({
        message: "Validation error",
        errors,
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

// Change password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Validate required fields
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: "Current password and new password are required",
      errors: {
        currentPassword: !currentPassword
          ? "Current password is required"
          : null,
        newPassword: !newPassword ? "New password is required" : null,
      },
    });
  }

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Current password is incorrect",
        field: "currentPassword",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  changePassword,
  createAdmin,
  getCurrentUser,
  login,
  register,
  updateProfile,
};
