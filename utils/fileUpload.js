import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directories exist
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

// Configure upload paths
const uploadDir = path.join(__dirname, "../public/uploads");
const productsDir = path.join(uploadDir, "products");
const categoriesDir = path.join(uploadDir, "categories");
const usersDir = path.join(uploadDir, "users");

// Ensure directories exist
ensureDirectoryExists(productsDir);
ensureDirectoryExists(categoriesDir);
ensureDirectoryExists(usersDir);

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

  // Determine target directory
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

  // Generate unique filename with timestamp
  const fileExt = path.extname(file.name);
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
  const filePath = path.join(targetDir, fileName);

  // Move file to target directory
  try {
    await file.mv(filePath);

    // Return the URL path (not filesystem path)
    return `/uploads/${type}/${fileName}`;
  } catch (error) {
    console.error("File upload error:", error);
    throw new Error("Failed to upload file");
  }
};

/**
 * Delete a file
 * @param {String} fileUrl - The URL path of the file to delete
 * @returns {Promise<Boolean>} - True if deleted, false otherwise
 */
export const deleteFile = async (fileUrl) => {
  if (!fileUrl) return false;

  try {
    // Convert URL path to filesystem path
    const filePath = path.join(__dirname, "../public", fileUrl);

    // Check if file exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("File deletion error:", error);
    return false;
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
