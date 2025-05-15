import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Check if we're running on Vercel
const isVercel = process.env.VERCEL === "1";

// Only use fileURLToPath in non-Vercel environments
let __dirname;
let uploadDir;
let productsDir;
let categoriesDir;
let usersDir;

if (!isVercel) {
  const __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);

  // Configure upload paths for local environment
  uploadDir = path.join(__dirname, "../public/uploads");
  productsDir = path.join(uploadDir, "products");
  categoriesDir = path.join(uploadDir, "categories");
  usersDir = path.join(uploadDir, "users");

  // Ensure upload directories exist in local environment
  if (!fs.existsSync(productsDir)) {
    fs.mkdirSync(productsDir, { recursive: true });
  }
  if (!fs.existsSync(categoriesDir)) {
    fs.mkdirSync(categoriesDir, { recursive: true });
  }
  if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir, { recursive: true });
  }
}

// Mock paths for Vercel environment
const mockFilePaths = {
  products: "/uploads/products/",
  categories: "/uploads/categories/",
  users: "/uploads/users/",
};

/**
 * Upload a file
 * @param {Object} file - The file object from express-fileupload
 * @param {String} type - The type of upload ('products', 'categories', 'users')
 * @returns {Promise<String>} - URL path to the uploaded file
 */
export const uploadFile = async (file, type = "products") => {
  if (!file) {
    throw new Error("No file provided");
  }

  // Validate file type
  const validFileTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg",
  ];
  if (!validFileTypes.includes(file.mimetype)) {
    throw new Error(
      "Invalid file type. Only JPEG, PNG, WEBP, GIF and SVG are allowed"
    );
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error("File size exceeds 5MB limit");
  }

  // Generate unique filename with timestamp
  const fileExt = path.extname(file.name);
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;

  // Handle differently based on environment
  if (isVercel) {
    // For Vercel, just return a mock URL path
    console.log(`[Vercel] Mock file upload: ${type}/${fileName}`);
    return `${mockFilePaths[type] || "/uploads/"}${fileName}`;
  } else {
    // For local development, actually save the file
    let targetDir;
    switch (type) {
      case "products":
        targetDir = productsDir;
        break;
      case "categories":
        targetDir = categoriesDir;
        break;
      case "users":
        targetDir = usersDir;
        break;
      default:
        targetDir = uploadDir;
    }

    const filePath = path.join(targetDir, fileName);

    try {
      await file.mv(filePath);
      return `/uploads/${type}/${fileName}`;
    } catch (error) {
      console.error("File upload error:", error);
      throw new Error("Failed to upload file");
    }
  }
};

/**
 * Delete a file
 * @param {String} fileUrl - The URL path of the file to delete
 * @returns {Promise<Boolean>} - True if deleted, false otherwise
 */
export const deleteFile = async (fileUrl) => {
  if (!fileUrl) return false;

  if (isVercel) {
    // For Vercel, just log and return true
    console.log(`[Vercel] Mock file deletion: ${fileUrl}`);
    return true;
  } else {
    // For local development, actually delete the file
    try {
      const filePath = path.join(__dirname, "../public", fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error("File deletion error:", error);
      return false;
    }
  }
};

/**
 * Handle multiple file uploads
 * @param {Array} files - Array of file objects
 * @param {String} type - The type of upload
 * @returns {Promise<Array>} - Array of URL paths
 */
export const uploadMultipleFiles = async (files, type = "products") => {
  if (!files || !Array.isArray(files)) {
    throw new Error("No files provided or invalid files array");
  }

  const uploadPromises = files.map((file) => uploadFile(file, type));
  return Promise.all(uploadPromises);
};

export default {
  uploadFile,
  deleteFile,
  uploadMultipleFiles,
};
