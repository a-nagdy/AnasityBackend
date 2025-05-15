import path from "path";

// Mock implementation for Vercel deployment
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

  // Generate a mock file path that would have been created
  const fileExt = path.extname(file.name);
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;

  // For Vercel deployment, we'll just return a mock URL
  // In production, you should replace this with S3, Cloudinary, or another storage service
  console.log(`Mock file upload: ${type}/${fileName}`);
  return `${mockFilePaths[type] || "/uploads/"}${fileName}`;
};

/**
 * Delete a file
 * @param {String} fileUrl - The URL path of the file to delete
 * @returns {Promise<Boolean>} - True if deleted, false otherwise
 */
export const deleteFile = async (fileUrl) => {
  if (!fileUrl) return false;

  // Mock implementation for Vercel
  console.log(`Mock file deletion: ${fileUrl}`);
  return true;
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
