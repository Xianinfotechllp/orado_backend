// controllers/storeController.js
const Restaurant =  require('../models/restaurantModel');

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

    // Field Validation
    if (!name || !ownerId || !phone || !address || !storeType || !city) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, ownerId, phone, address, storeType, city",
      });
    }

    // File Validation
    const imageFiles = req.files?.images;
    const fssaiDoc = req.files?.fssaiDoc?.[0];
    const gstDoc = req.files?.gstDoc?.[0];
    const aadharDoc = req.files?.aadharDoc?.[0];

    if (!imageFiles || imageFiles.length === 0 || !fssaiDoc || !gstDoc || !aadharDoc) {
      return res.status(400).json({
        success: false,
        message: "All documents (images, FSSAI, GST, Aadhar) are required.",
      });
    }

    const images = imageFiles.map((file) => file.path);
    const fssaiDocUrl = fssaiDoc.path;
    const gstDocUrl = gstDoc.path;
    const aadharDocUrl = aadharDoc.path;

    const newStore = new Restaurant({
      name,
      ownerId,
      ownerName,
      phone,
      email,
      address: typeof address === 'string' ? JSON.parse(address) : address,
      storeType,
      foodType,
      city,
      paymentMethods,
      minOrderAmount,
      commission,
      preparationTime,
      openingHours: typeof openingHours === 'string' ? JSON.parse(openingHours) : openingHours,
      images,
      kycDocuments: {
        fssaiDocUrl,
        gstDocUrl,
        aadharDocUrl,
      },
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
