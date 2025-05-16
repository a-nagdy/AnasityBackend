import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { deleteFromCloudinary, uploadToCloudinary } from "./cloudinary.js";

// Check if we're running on Vercel
const isVercel = process.env.VERCEL === "1";
const useCloudinary = process.env.USE_CLOUDINARY === "1" || isVercel;

// Only use fileURLToPath in non-Vercel environments
let __dirname;
let uploadDir;
let productsDir;
let categoriesDir;
let usersDir;

if (!isVercel && !useCloudinary) {
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
 * @returns {Promise<Object>} - Upload result with URL path and public ID
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

  // Use Cloudinary in production or when specifically enabled
  if (useCloudinary) {
    try {
      // Upload to Cloudinary
      const result = await uploadToCloudinary(file.tempFilePath || file.data, {
        folder: `anasity/${type}`,
        public_id: path.parse(fileName).name, // Use filename without extension
      });

      // Return both URL and public_id for future reference
      return {
        url: result.url,
        publicId: result.public_id,
      };
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      throw new Error("Failed to upload file to cloud storage");
    }
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
      // Return local path and null for publicId (as we don't have one for local files)
      return {
        url: `/uploads/${type}/${fileName}`,
        publicId: null,
      };
    } catch (error) {
      console.error("File upload error:", error);
      throw new Error("Failed to upload file locally");
    }
  }
};

/**
 * Delete a file
 * @param {String} fileUrl - The URL path of the file to delete
 * @param {String} publicId - The Cloudinary public ID (if available)
 * @returns {Promise<Boolean>} - True if deleted, false otherwise
 */
export const deleteFile = async (fileUrl, publicId = null) => {
  if (!fileUrl && !publicId) return false;

  if (useCloudinary && publicId) {
    try {
      // Delete from Cloudinary using the public ID
      const result = await deleteFromCloudinary(publicId);
      return result.result === "ok";
    } catch (error) {
      console.error("Cloudinary deletion error:", error);
      return false;
    }
  } else if (!isVercel && !useCloudinary) {
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
  } else {
    // For Vercel without public ID, just log and return true
    console.log(`[Vercel] Mock file deletion: ${fileUrl}`);
    return true;
  }
};

/**
 * Handle multiple file uploads
 * @param {Array} files - Array of file objects
 * @param {String} type - The type of upload
 * @returns {Promise<Array>} - Array of upload results with URLs and public IDs
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
