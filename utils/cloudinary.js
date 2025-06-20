const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET  
});

const uploadOnCloudinary = async (localFilePath, folder = 'orado_uploads') => {
  try {
    if (!localFilePath) return null;

    const ext = path.extname(localFilePath).toLowerCase();
    const resourceType = ['.pdf', '.docx', '.xlsx', '.csv', '.zip'].includes(ext)
      ? 'raw'
      : 'auto';

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: resourceType,
      folder
    });

    // ✅ Safe delete after upload
    try {
      if (fs.existsSync(localFilePath)) {
        await new Promise(res => setTimeout(res, 100)); // In case it's still in use
        await fs.promises.unlink(localFilePath);
      } else {
        console.warn("🚫 File not found:", localFilePath);
      }
    } catch (unlinkErr) {
      console.error("❌ Failed to delete:", localFilePath, unlinkErr);
    }


    return response;
  } catch (error) {
    // ✅ Cleanup even on error
    if (fs.existsSync(localFilePath)) {
      try {
        await fs.promises.unlink(localFilePath);
      } catch (delErr) {
        console.error("Failed to delete file after error:", delErr);
      }
    }
    console.error("Cloudinary upload error:", error);
    return null;
  }
};

module.exports = { uploadOnCloudinary };
