import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fileUpload from "express-fileupload";
import mongoose from "mongoose";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import addressRoutes from "./routes/Address/Address.js";
import authRoutes from "./routes/Auth/Auth.js";
import cartRoutes from "./routes/Cart/Cart.js";
import categoryRoutes from "./routes/Categories/Categories.js";
import checkoutRoutes from "./routes/Checkout/Checkout.js";
import ordersRoutes from "./routes/Orders/Orders.js";
import paymentRoutes from "./routes/Payment/Payment.js";
import productRoutes from "./routes/Products/Products.js";
import shippingRoutes from "./routes/Shipping/Shipping.js";

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());
app.use(fileUpload());

// Use Morgan in development mode
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection function
const connectDB = async () => {
  try {
    // For Vercel, we'll leave bufferCommands enabled (don't set it to false)
    // This allows operations to be buffered until connection is established
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10s timeout
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
    });
    console.log("MongoDB Connected Successfully");
    return true;
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
    return false;
  }
};

// API Routes setup function
const setupRoutes = () => {
  // API Routes
  app.use("/api/products", productRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/shipping", shippingRoutes);
  app.use("/api/payment", paymentRoutes);
  app.use("/api/checkout", checkoutRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/addresses", addressRoutes);

  // Base route
  app.get("/", (req, res) => {
    res.json({
      message: "Welcome to Anasity API",
      version: "1.0.0",
      docs: "/api/docs",
    });
  });

  // Handle 404
  app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  });
};

// Check if we're in a Vercel serverless environment
const isVercel = process.env.VERCEL === "1";

// Initialize server (only for local development)
const startServer = async () => {
  // First connect to the database
  const connected = await connectDB();

  // Set up routes regardless of connection status
  setupRoutes();

  // Only start the server if not in a serverless environment
  if (!isVercel) {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      if (!connected) {
        console.log(
          "Warning: Server started but MongoDB connection failed. Some features may not work correctly."
        );
      }
    });
  }
};

// For local development, start the server
if (!isVercel) {
  startServer();
} else {
  // For Vercel serverless, just connect to DB and set up routes
  // (no need to explicitly start the server)
  connectDB().then(() => {
    setupRoutes();
    console.log("Serverless mode: Routes configured");
  });
}

// For Vercel serverless function
export default app;
