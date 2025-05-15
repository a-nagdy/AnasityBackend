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

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Connection Error: ", err));

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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
