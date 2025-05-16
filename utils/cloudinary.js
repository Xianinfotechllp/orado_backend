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

    const resourceType = ['.pdf', '.docx', '.xlsx', '.csv', '.zip'].includes(ext)
      ? 'raw'
      : 'auto';


    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: resourceType
    });

    fs.unlinkSync(localFilePath); // clean up local file
    return response;
  } catch (error) {
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath); 
    }
    console.error("Cloudinary upload error:", error);
    return null;
  }
};

module.exports = { uploadOnCloudinary };
