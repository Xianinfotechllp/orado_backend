// controllers/storeController.js
const Restaurant =  require('../models/restaurantModel');

const { uploadOnCloudinary } = require("../utils/cloudinary");
exports.createStore = async (req, res) => {
  try {
    const {
      name,
      ownerId,
      ownerName,
      phone,
      email,
      address,
      storeType,
      foodType,
      city,
      paymentMethods,
      minOrderAmount,
      commission,
      preparationTime,
      openingHours,
    } = req.body;

    // Field validation
    if (!name || !ownerId || !phone || !address || !storeType || !city) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, ownerId, phone, address, storeType, city",
      });
    }

    const imageFiles = req.files?.images || [];
    const fssaiDoc = req.files?.fssaiDoc?.[0];
    const gstDoc = req.files?.gstDoc?.[0];
    const aadharDoc = req.files?.aadharDoc?.[0];

    if (!imageFiles.length || !fssaiDoc || !gstDoc || !aadharDoc) {
      return res.status(400).json({
        success: false,
        message: "All documents (images, FSSAI, GST, Aadhar) are required.",
      });
    }

    // ✅ Upload images
    const imageUploadResults = await Promise.all(
      imageFiles.map((file) => uploadOnCloudinary(file.path, "orado/stores/images"))
    );
    const imageUrls = imageUploadResults.map((img) => img?.secure_url).filter(Boolean);

    // ✅ Upload documents
    const fssaiUpload = await uploadOnCloudinary(fssaiDoc.path, "orado/stores/docs");
    const gstUpload = await uploadOnCloudinary(gstDoc.path, "orado/stores/docs");
    const aadharUpload = await uploadOnCloudinary(aadharDoc.path, "orado/stores/docs");

    if (!fssaiUpload || !gstUpload || !aadharUpload) {
      return res.status(500).json({
        success: false,
        message: "Document upload failed",
      });
    }

    const parsedAddress = typeof address === "string" ? JSON.parse(address) : address;
    const parsedOpeningHours = typeof openingHours === "string" ? JSON.parse(openingHours) : openingHours;

    const newStore = new Restaurant({
      name,
      ownerId,
      ownerName,
      phone,
      email,
      address: parsedAddress,
      storeType,
      foodType,
      city,
      paymentMethods,
      minOrderAmount,
      commission,
      preparationTime,
      openingHours: parsedOpeningHours,
      images: imageUrls,
      kycDocuments: {
        fssaiDocUrl: fssaiUpload.secure_url,
        gstDocUrl: gstUpload.secure_url,
        aadharDocUrl: aadharUpload.secure_url,
      },
      location: {
        type: "Point",
        coordinates: [
          parseFloat(parsedAddress?.longitude) || 0,
          parseFloat(parsedAddress?.latitude) || 0,
        ],
      }
    });

    const saved = await newStore.save();
    res.status(201).json({ success: true, data: saved });

  } catch (err) {
    console.error("Create store error:", err.message);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: err.message,
    });
  }
};
