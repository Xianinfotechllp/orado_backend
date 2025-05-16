const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path'); // 🧠 THIS LINE WAS MISSING

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET  
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const ext = path.extname(localFilePath).toLowerCase(); // 🧠 Now this works

    // Smart switch: PDF and such use raw, rest default to auto
    const resourceType = ['.pdf', '.docx', '.xlsx', '.csv', '.zip'].includes(ext)
      ? 'raw'
      : 'auto';

    console.log("Uploading with resource_type:", resourceType, "| File:", localFilePath);

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: resourceType
    });

    fs.unlinkSync(localFilePath); // clean up local file
    return response;
  } catch (error) {
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath); // always clean up even on fail
    }
    console.error("Cloudinary upload error:", error);
    return null;
  }
};

module.exports = { uploadOnCloudinary };
