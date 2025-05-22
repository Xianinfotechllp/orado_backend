const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET  
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const ext = path.extname(localFilePath).toLowerCase();
    const resourceType = ['.pdf', '.docx', '.xlsx', '.csv', '.zip'].includes(ext)
      ? 'raw'
      : 'auto';

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: resourceType
    });

    // ✅ Safe delete
    if (fs.existsSync(localFilePath)) {
      fs.unlink(localFilePath, err => {
        if (err) console.error("Failed to delete file:", err);
      });
    }

    return response;
  } catch (error) {
    // ✅ Handle deletion even in error case
    if (fs.existsSync(localFilePath)) {
      fs.unlink(localFilePath, err => {
        if (err) console.error("Cleanup failed:", err);
      });
    }
    console.error("Cloudinary upload error:", error);
    return null;
  }
};

module.exports = { uploadOnCloudinary };
