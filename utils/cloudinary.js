import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary
 * @param {String|Buffer} file - File path or buffer to upload
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
export const uploadToCloudinary = async (file, options = {}) => {
  try {
    // Set default folder structure for organizing uploads
    const folder = options.folder || "anasity";

    // Merge with default options
    const uploadOptions = {
      folder,
      resource_type: "auto",
      ...options,
    };

    // Upload the file
    const result = await cloudinary.uploader.upload(file, uploadOptions);

    return {
      public_id: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
  }
};

/**
 * Delete a file from Cloudinary
 * @param {String} publicId - The public ID of the file to delete
 * @returns {Promise<Object>} Cloudinary deletion result
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return { result: "nothing to delete" };

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Cloudinary deletion error:", error);
    throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
  }
};

/**
 * Get optimized image URL from Cloudinary
 * @param {String} publicId - The public ID of the image
 * @param {Object} options - Transformation options
 * @returns {String} Optimized image URL
 */
export const getOptimizedUrl = (publicId, options = {}) => {
  const defaultOptions = {
    fetch_format: "auto",
    quality: "auto",
    ...options,
  };

  return cloudinary.url(publicId, defaultOptions);
};

export default {
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedUrl,
};
