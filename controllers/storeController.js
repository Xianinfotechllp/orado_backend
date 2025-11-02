// controllers/storeController.js
const Restaurant =  require('../models/restaurantModel');
const Category = require("../models/categoryModel")
const Product = require("../models/productModel")
const { uploadOnCloudinary } = require("../utils/cloudinary");
const fs = require("fs");
const User = require("../models/userModel");
const xlsx = require("xlsx");
const ExcelJS = require("exceljs");
const moment = require('moment')
const Order = require("../models/orderModel")
const mongoose = require('mongoose')
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


    console.log(req.body)
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

exports.createMerchantAndStore = async (req, res) => {
  try {
    const {
      // Merchant fields
      ownerName,
      phone,
      email,
      password, // should be hashed before saving
      // Store fields
      name,
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



    console.log("req.body:", req.body);
    // ===== Validate Required Fields =====
    if (!name || !ownerName || !phone || !address || !storeType || !city) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, ownerName, phone, address, storeType, city",
      });
    }

    // ✅ Check if merchant already exists
    const existingMerchant = await User.findOne({ phone });
    if (existingMerchant) {
      return res.status(400).json({
        success: false,
        message: "Merchant with this phone already exists.",
      });
    }

    // ✅ Create Merchant (using User model)
    const newMerchant = new User({
      name: ownerName,
      phone,
      email,
      password, // hash this with bcrypt
      userType: "merchant",
      active: true,
    });

    const savedMerchant = await newMerchant.save();

    // ===== Handle File Uploads =====
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
      imageFiles.map((file) =>
        uploadOnCloudinary(file.path, "orado/stores/images")
      )
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

    // ===== Parse JSON fields =====
    const parsedAddress = typeof address === "string" ? JSON.parse(address) : address;
    const parsedOpeningHours = typeof openingHours === "string" ? JSON.parse(openingHours) : openingHours;

    // ===== Create Store =====
    const newStore = new Restaurant({
      name,
      ownerId: savedMerchant._id, // link to merchant
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
      },
    });

    const savedStore = await newStore.save();

    // ===== Return Combined Response =====
    return res.status(201).json({
      success: true,
      message: "Merchant (User) and Store created successfully",
      data: {
        merchant: savedMerchant,
        store: savedStore,
      },
    });
  } catch (err) {
    console.error("Create Merchant & Store Error:", err.message);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: err.message,
    });
  }
};



exports.storeProduct = async (req, res) => {
  try {
    // Convert body to a plain object (fix for [Object: null prototype])
    const body = Object.fromEntries(Object.entries(req.body || {}));
    console.log("Received body:", body);

    const {
      name,
      description,
      price,
      categoryId,
      storeId,
      active,
      preparationTime,
      availability,
      availableAfterTime,
      availableFromTime,
      availableToTime,
      foodType,
      unit,
      enableInventory,
      stock,
      reorderLevel,
      costPrice,
      minimumOrderQuantity,
      maximumOrderQuantity,
    } = body;

    // 🧩 Validate required fields
    if (!name || !price || !categoryId || !storeId || !foodType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 🧮 Convert numeric fields safely
    const numericFields = {
      price: parseFloat(price),
      preparationTime: parseInt(preparationTime) || 10,
      stock: parseInt(stock) || 0,
      reorderLevel: parseInt(reorderLevel) || 0,
      costPrice: parseFloat(costPrice) || 0,
      minimumOrderQuantity: parseInt(minimumOrderQuantity) || 1,
      maximumOrderQuantity: parseInt(maximumOrderQuantity) || 100,
    };

    // 🧠 Validate numeric constraints
    if (isNaN(numericFields.price)) {
      return res.status(400).json({ message: "Price must be a valid number" });
    }
    if (numericFields.minimumOrderQuantity < 1 || numericFields.maximumOrderQuantity < 1) {
      return res.status(400).json({ message: "Min and max quantity must be greater than 0" });
    }
    if (numericFields.maximumOrderQuantity < numericFields.minimumOrderQuantity) {
      return res.status(400).json({ message: "Max quantity must be >= min quantity" });
    }

    // 🕒 Handle availability
    let availableFromField = null;
    let availableToField = null;
    let availableAfterField = null;

    if (availability === "time-range") {
      if (!availableFromTime || !availableToTime) {
        return res.status(400).json({
          message: "Please provide 'availableFromTime' and 'availableToTime' for time-range availability",
        });
      }
      availableFromField = availableFromTime;
      availableToField = availableToTime;
    } else if (availability === "time-based") {
      availableAfterField = availableAfterTime || null;
    }

    // 🖼️ Handle image uploads
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadResult = await uploadOnCloudinary(file.path, "product_images");
          if (uploadResult?.secure_url) imageUrls.push(uploadResult.secure_url);
        } catch (err) {
          console.error("Cloudinary upload failed:", err);
        } finally {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path); // Clean up temp file
        }
      }
    }

    // 🧾 Create product
    const newProduct = new Product({
      name,
      description: description || "",
      price: numericFields.price,
      categoryId,
      restaurantId: storeId,
      images: imageUrls,
      active: active === "true" || active === true,
      preparationTime: numericFields.preparationTime,
      availability: availability || "always",
      availableAfterTime: availableAfterField,
      availableFromTime: availableFromField,
      availableToTime: availableToField,
      foodType,
      addOns: [],
      specialOffer: { discount: 0, startDate: null, endDate: null },
      rating: 0,
      attributes: [],
      unit: unit || "piece",
      enableInventory: enableInventory === "true" || enableInventory === true,
      stock: numericFields.stock,
      reorderLevel: numericFields.reorderLevel,
      revenueShare: { type: "percentage", value: 10 },
      costPrice: numericFields.costPrice,
      minimumOrderQuantity: numericFields.minimumOrderQuantity,
      maximumOrderQuantity: numericFields.maximumOrderQuantity,
    });

    await newProduct.save();

    return res.status(201).json({
      message: "✅ Product created successfully",
      data: newProduct,
    });
  } catch (err) {
    console.error("❌ Error storing product:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}; 
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const existingProduct = await Product.findById(id);

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 🔹 Convert req.body to a clean plain object
    const body = Object.fromEntries(Object.entries(req.body || {}));
    console.log("Sanitized Body:", body);

    const updates = {};

    // 🔹 Safely convert numeric fields
    const numericFields = {
      price: body.price ? parseFloat(body.price) : undefined,
      preparationTime: body.preparationTime ? parseInt(body.preparationTime) : undefined,
      stock: body.stock ? parseInt(body.stock) : undefined,
      reorderLevel: body.reorderLevel ? parseInt(body.reorderLevel) : undefined,
      costPrice: body.costPrice ? parseFloat(body.costPrice) : undefined,
      minimumOrderQuantity: body.minimumOrderQuantity ? parseInt(body.minimumOrderQuantity) : undefined,
      maximumOrderQuantity: body.maximumOrderQuantity ? parseInt(body.maximumOrderQuantity) : undefined,
    };

    // 🔹 Basic fields
    if (body.name) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (!isNaN(numericFields.price)) updates.price = numericFields.price;
    if (body.categoryId) updates.categoryId = body.categoryId;
    if (body.storeId) updates.restaurantId = body.storeId;
    if (!isNaN(numericFields.preparationTime)) updates.preparationTime = numericFields.preparationTime;
    if (body.foodType) updates.foodType = body.foodType;
    if (body.unit) updates.unit = body.unit;
    if (!isNaN(numericFields.stock)) updates.stock = numericFields.stock;
    if (!isNaN(numericFields.reorderLevel)) updates.reorderLevel = numericFields.reorderLevel;
    if (!isNaN(numericFields.costPrice)) updates.costPrice = numericFields.costPrice;
    if (!isNaN(numericFields.minimumOrderQuantity)) updates.minimumOrderQuantity = numericFields.minimumOrderQuantity;
    if (!isNaN(numericFields.maximumOrderQuantity)) updates.maximumOrderQuantity = numericFields.maximumOrderQuantity;

    // 🔹 Handle boolean fields safely
    if (body.active && body.active !== "undefined") {
      updates.active = body.active === "true" || body.active === true;
    }

    if (body.enableInventory && body.enableInventory !== "undefined") {
      updates.enableInventory = body.enableInventory === "true" || body.enableInventory === true;
    }

    // 🔹 Handle availability fields
    if (body.availability) {
      updates.availability = body.availability;

      if (body.availability === "time-range") {
        // Validate input times
        if (!body.availableFromTime || !body.availableToTime) {
          return res.status(400).json({
            message: "Please provide both 'availableFromTime' and 'availableToTime' for time-range availability.",
          });
        }

        updates.availableFromTime = body.availableFromTime;
        updates.availableToTime = body.availableToTime;
      } else {
        // Clear if not using time range
        updates.availableFromTime = null;
        updates.availableToTime = null;
      }
    }

    // 🔹 Handle image removal
    let finalImages = existingProduct.images || [];
    if (body.imagesToRemove) {
      try {
        const imagesToRemove = JSON.parse(body.imagesToRemove);
        finalImages = finalImages.filter((img) => !imagesToRemove.includes(img));
      } catch (err) {
        console.warn("⚠️ Invalid imagesToRemove format");
      }
    }

    // 🔹 Handle new image uploads
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploaded = await uploadOnCloudinary(file.path, "product_images");
          if (uploaded?.secure_url) {
            finalImages.push(uploaded.secure_url);
          }
        } catch (err) {
          console.error("Cloudinary upload failed:", err);
        } finally {
          // Clean up temp file
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
      }
    }

    updates.images = finalImages;

    // 🔹 Perform update
    const updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true });

    return res.status(200).json({
      message: "✅ Product updated successfully",
      data: updatedProduct,
    });
  } catch (err) {
    console.error("❌ Error updating product:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};








// Create Category

exports.createCategory = async (req, res) => {
  try {
    const {
      name,
      restaurantId,
      availability,
      availableFromTime,
      availableToTime,
      description,
      active,
      autoOnOff
    } = req.body;

    // Validation
    if (!name || !restaurantId) {
      return res.status(400).json({ message: "Name and Restaurant ID are required" });
    }

    let imageUrls = [];

    // Upload images to Cloudinary
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        try {
          const uploaded = await uploadOnCloudinary(file.path);
          if (uploaded?.secure_url) {
            imageUrls.push(uploaded.secure_url);
          }

          // Remove temporary local file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (uploadErr) {
          console.error(`Cloudinary upload failed for ${file.originalname}:`, uploadErr);
        }
      }
    }

    // Build category data object
    const categoryData = {
      name,
      restaurantId,
      availability,
      description,
      autoOnOff,
      active,
      images: imageUrls,
    };

    // Handle time-range availability
    if (availability === "time-range") {
      categoryData.availableFromTime = availableFromTime || null;
      categoryData.availableToTime = availableToTime || null;
    } else {
      categoryData.availableFromTime = null;
      categoryData.availableToTime = null;
    }

    const category = await Category.create(categoryData);

    return res.status(201).json({
      message: "Category created successfully",
      data: category,
    });

  } catch (error) {
    console.error("Create Category Error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};





exports.createCategoryWithStore = async (req, res) => {
  try {
    const { storeId } = req.params; // Get restaurant/store ID from URL param
    const {
      name,
      availability,
      availableAfterTime,
      description,
      active,
      autoOnOff
    } = req.body;

    if (!name || !storeId) {
      return res.status(400).json({ message: "Name and Store ID are required" });
    }

    let imageUrls = [];

    // Upload images to Cloudinary
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        try {
          const uploaded = await uploadOnCloudinary(file.path);
          if (uploaded?.secure_url) {
            imageUrls.push(uploaded.secure_url);
          }

          // Safe unlink (delete temp file)
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (uploadErr) {
          console.error(`Cloudinary upload failed for ${file.originalname}:`, uploadErr);
        }
      }
    }

    const category = await Category.create({
      name,
      restaurantId: storeId, // use storeId from URL param
      availability,
      availableAfterTime,
      description,
      autoOnOff,
      active,
      images: imageUrls,
    });

    return res.status(201).json({
      message: "Category created successfully",
      data: category,
    });

  } catch (error) {
    console.error("Create Category Error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};
// Update Category
exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const {
      name,
      availability,
      availableFromTime,
      availableToTime,
      description,
      active,
      restaurantId, // optional
      autoOnOff,
      imagesToRemove = [],
    } = req.body;
 


    console.log(req.body)
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Remove selected images
    if (imagesToRemove.length) {
      category.images = category.images.filter(
        (img) => !imagesToRemove.includes(img)
      );
    }

    // Upload new images
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const uploadedUrl = await uploadOnCloudinary(file.path);
        if (uploadedUrl) category.images.push(uploadedUrl);
        fs.unlinkSync(file.path);
      }
    }

    // Update general fields
    if (name) category.name = name;
    if (availability) category.availability = availability;
    if (description) category.description = description;
    if (typeof active !== "undefined") category.active = active;
    if (typeof autoOnOff !== "undefined") category.autoOnOff = autoOnOff;
    if (restaurantId) category.restaurantId = restaurantId;

    // Handle time-range availability specifically
    if (availability === "time-range") {
      category.availableFromTime = availableFromTime || null;
      category.availableToTime = availableToTime || null;
    } else {
      // If not time-range, clear the times
      category.availableFromTime = null;
      category.availableToTime = null;
    }

    await category.save();

    return res.status(200).json({
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Update Category Error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};



exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete category
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Optional: If you also want to delete products under this category
    // await Product.deleteMany({ categoryId: id });

    res.status(200).json({ message: "Category deleted successfully", category });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


exports.toggleProductStatus = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found', messageType: 'failure' });
    }

    // Toggle the current active status
    product.active = !product.active;
    await product.save();

    res.status(200).json({
      message: `Product ${product.active ? 'activated' : 'deactivated'} successfully.`,
      messageType: 'success',
      data: product
    });
  } catch (error) {
    console.error('Error toggling product status:', error);
    res.status(500).json({ message: 'Internal server error', messageType: 'failure' });
  }
};

exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ 
        message: 'Category not found', 
        messageType: 'failure' 
      });
    }

    // Toggle the current active status
    category.active = !category.active;
    await category.save();

    res.status(200).json({
      message: `Category ${category.active ? 'activated' : 'deactivated'} successfully.`,
      messageType: 'success',
      data: category
    });
  } catch (error) {
    console.error('Error toggling category status:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      messageType: 'failure' 
    });
  }
};


exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;


    const product = await Product.findOne({ _id: productId });

    if (!product) {
      return res.status(404).json({ message: 'Product not found for this restaurant.' });
    }

    await Product.deleteOne({ _id: productId });

    return res.status(200).json({ message: 'Product deleted successfully.' });
  } catch (err) {
    console.error('Delete Product Error:', err);
    return res.status(500).json({ message: 'Server error while deleting product.' });
  }
};



exports.importCategories = async (req, res) => {
  try {
    const { restaurantId } = req.params; // from URL
    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Please upload an Excel file" });
    }

    // Read uploaded Excel from buffer
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON
    const categories = xlsx.utils.sheet_to_json(sheet);

    if (!categories.length) {
      return res.status(400).json({ message: "Excel file is empty" });
    }

    // Format categories for DB
    const formattedCategories = categories.map((cat) => ({
      name: cat.name || "",
      restaurantId, // always use from API, not Excel
      availability: cat.availability || "always",
      availableAfterTime: cat.availableAfterTime || null,
      active: cat.active !== undefined ? Boolean(cat.active) : true,
      description: cat.description || "",
      images: cat.images ? cat.images.split(",") : [],
    }));

    // Insert into MongoDB
    const savedCategories = await Category.insertMany(formattedCategories);

    // Push categories into Restaurant.categories[]
    await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $push: { categories: { $each: savedCategories.map((c) => c._id) } } },
      { new: true }
    );

    return res.status(200).json({
      message: "Categories imported successfully!",
      count: savedCategories.length,
      savedCategories,
    });
  } catch (error) {
    console.error("Error importing categories:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.downloadCategoryTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Categories Template");

    // Define columns
    worksheet.columns = [
      { header: "name", key: "name", width: 30 },
      { header: "description", key: "description", width: 30 },
      { header: "availability", key: "availability", width: 20 }, // always, time-based, disabled
      { header: "availableAfterTime", key: "availableAfterTime", width: 20 },
      { header: "active", key: "active", width: 10 }, // true / false
      { header: "images", key: "images", width: 40 }, // comma-separated URLs
    ];

    // Add one sample row
    worksheet.addRow({
      name: "Pizza",
      description: "Italian pizza with cheese",
      availability: "always",
      availableAfterTime: "",
      active: true,
      images: "https://example.com/pizza.jpg",
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=category_template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).json({ message: "Error generating template", error });
  }
};







exports.exportCategories = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Fetch categories for the restaurant
    const categories = await Category.find({ restaurantId }).lean();
    if (!categories.length) {
      return res.status(404).json({ message: "No categories found." });
    }

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Categories");

    // Define columns (include _id for bulk edit; can be hidden if desired)
    worksheet.columns = [
      { header: "Category ID", key: "_id", width: 30 }, // optional: hidden
      { header: "Category Name", key: "name", width: 30 },
      { header: "Description", key: "description", width: 40 },
      { header: "Status", key: "status", width: 15 },
      { header: "Availability", key: "availability", width: 20 },
      { header: "Available After Time", key: "availableAfterTime", width: 25 },
    ];

    // Add category data rows
    categories.forEach((cat) => {
      worksheet.addRow({
        _id: cat._id, // for safe bulk editing
        name: cat.name,
        description: cat.description || "",
        status: cat.active ? "Active" : "Inactive",
        availability: cat.availability || "always",
        availableAfterTime: cat.availableAfterTime || "",
      });
    });

    // Optionally hide the _id column in Excel
    worksheet.getColumn("_id").hidden = true;

    // Set response headers for download
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=categories.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Write workbook to the response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Categories Error:", error);
    res.status(500).json({ message: "Failed to export categories." });
  }
};









exports.bulkEditCategories = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    const rows = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip headers

      let [_id, name, description, availability, availableAfterTime, active, images] =
        row.values.slice(1);

      const cleanId = _id ? _id.toString().replace(/"/g, "").trim() : null;
      const cleanName = name ? name.toString().trim() : "";

      // 🚨 Skip if no ID and no name
      if (!cleanId && !cleanName) return;

      rows.push({
        _id: cleanId,
        name: cleanName,
        description: description?.toString().trim() || "",
        availability: availability?.toString().trim() || "always",
        availableAfterTime: availableAfterTime || "",
        active: active === true || active === "true",
        images: images
          ? images.toString().split(",").map((url) => url.trim())
          : [],
      });
    });

    // Save updates and creations
    const savedCategories = (
      await Promise.all(
        rows.map(async (catData) => {
          if (catData._id) {
            // 🔎 Skip updating if name is blank (avoid wiping categories)
            if (!catData.name) return null;

            return Category.findOneAndUpdate(
              { _id: catData._id, restaurantId },
              {
                name: catData.name,
                description: catData.description,
                availability: catData.availability,
                availableAfterTime: catData.availableAfterTime,
                active: catData.active,
                images: catData.images,
              },
              { new: true }
            );
          } else {
            // 🔎 Only create if name exists
            if (!catData.name) return null;
            return Category.create({ ...catData, restaurantId });
          }
        })
      )
    ).filter(Boolean); // remove nulls from skipped rows

    res.json({
      message: "Categories updated successfully.",
      count: savedCategories.length,
      savedCategories,
    });
  } catch (error) {
    console.error("Bulk Edit Categories Error:", error);
    res.status(500).json({ message: "Failed to bulk edit categories." });
  }
};





exports.exportProducts = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Fetch products for this restaurant
    const products = await Product.find({ restaurantId })
      .populate("categoryId", "name") // optional: populate category name
      .lean();

    if (!products.length) {
      return res.status(404).json({ message: "No products found." });
    }

    // Create workbook & worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products");

    // Define Excel columns
    worksheet.columns = [
      { header: "Product ID", key: "_id", width: 30 }, // keep hidden
      { header: "Product Name", key: "name", width: 30 },
      { header: "Description", key: "description", width: 40 },
      { header: "Price", key: "price", width: 15 },
      { header: "Category ID", key: "categoryId", width: 30 },
      { header: "Category Name", key: "categoryName", width: 25 },
      { header: "Food Type", key: "foodType", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Availability", key: "availability", width: 20 },
      { header: "Available After Time", key: "availableAfterTime", width: 25 },
      { header: "Preparation Time (mins)", key: "preparationTime", width: 25 },
      { header: "Has Inventory", key: "hasInventory", width: 15 },
      { header: "Stock", key: "stock", width: 15 },
      { header: "Images", key: "images", width: 50 },
    ];

    // Add product data rows
    products.forEach((prod) => {
   worksheet.addRow({
  _id: prod._id,
  name: prod.name,
  description: prod.description || "",
  price: prod.price || 0,
  categoryId: prod.categoryId?._id || prod.categoryId,
  categoryName: prod.categoryId?.name || "",
  foodType: prod.foodType,
  status: prod.active ? "Active" : "Inactive",
  availability: prod.availability || "always",
  availableAfterTime: prod.availableAfterTime || "",
  preparationTime: prod.preparationTime || 10,
  hasInventory: prod.hasInventory ? "Yes" : "No",   // <-- new field
  stock: prod.stock || 0,
  images: prod.images?.length ? prod.images.join(", ") : "",
});

    });

    // Hide Product ID column (internal use only)
    worksheet.getColumn("_id").hidden = true;
    worksheet.getColumn("images").alignment = { wrapText: false };

    // Set headers for download
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=products.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Stream workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Products Error:", error);
    res.status(500).json({ message: "Failed to export products." });
  }
};



exports.bulkEditProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Read Excel file buffer
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      return res.status(400).json({ message: "Uploaded file is empty" });
    }

    let updatedCount = 0;
    let errors = [];
    let updatedProducts = [];

    for (const row of rows) {
      try {
        if (!row["Product ID"]) continue;

        const productId = String(row["Product ID"]).trim().replace(/^"|"$/g, "");

        // ✅ Prepare update data safely
        const updateData = {
          name: row["Product Name"]?.trim() || undefined,
          description: row["Description"]?.trim() || undefined,
          price: row["Price"] ? Number(row["Price"]) : undefined,
          categoryId: row["Category ID"]
            ? String(row["Category ID"]).trim().replace(/^"|"$/g, "")
            : undefined,
          foodType: row["Food Type"]
            ? row["Food Type"].toLowerCase().trim()
            : undefined,
          active: row["Status"] === "Active",
          availability: row["Availability"]?.trim() || undefined,
          availableAfterTime: row["Available After Time"]?.trim() || undefined,
          preparationTime: row["Preparation Time (mins)"]
            ? Number(row["Preparation Time (mins)"])
            : undefined,
          enableInventory: row["Has Inventory"] === "Yes",
          stock: row["Stock"] ? Number(row["Stock"]) : undefined,
          images: row["Images"]
            ? row["Images"].split(",").map((s) => s.trim())
            : undefined,
        };

        // ✅ Remove undefined fields (don’t overwrite existing data)
        Object.keys(updateData).forEach(
          (key) => updateData[key] === undefined && delete updateData[key]
        );

        const updated = await Product.findByIdAndUpdate(productId, updateData, {
          new: true,
        });

        if (updated) {
          updatedCount++;
          updatedProducts.push(updated);
        }
      } catch (err) {
        errors.push({ row: row["Product ID"], error: err.message });
      }
    }

    return res.json({
      message: "✅ Bulk update completed",
      updatedCount,
      updatedProducts,
      errors,
    });
  } catch (error) {
    console.error("❌ Bulk Edit Products Error:", error);
    res.status(500).json({ message: "Failed to bulk update products." });
  }
};


exports.getCategoriesByStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    const categories = await Category.find({
      restaurantId: storeId, // still stored in DB as restaurantId field
      active: true
    }).sort({ name: 1 }); // sort alphabetically

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      categories
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message
    });
  }
};
exports.getProductsByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { categoryId, search, sortBy, sortOrder = "asc" } = req.query;

    const filters = {
      restaurantId: storeId, // still mapped to restaurantId in schema
      // active: true, // only fetch active products
    };

    if (categoryId) {
      filters.categoryId = categoryId;
    }

    if (search) {
      filters.name = { $regex: search, $options: "i" }; // case-insensitive search
    }

    // Sorting
    let sortQuery = {};
    if (sortBy) {
      sortQuery[sortBy] = sortOrder === "desc" ? -1 : 1;
    } else {
      sortQuery["name"] = 1; // default alphabetical
    }

    const products = await Product.find(filters)
      .populate("categoryId", "name")
      .sort(sortQuery);

    // Format products with availability logic
    const formattedProducts = products.map((product) => {
      let isAvailable = true;
      let unavailableReason = null;

      // Case 0: Product inactive
      if (!product.active) {
        isAvailable = false;
        unavailableReason = "Unavailable";
      }

      // Case 1: Out of stock (inventory enabled)
      else if (product.enableInventory && product.stock <= 0) {
        isAvailable = false;
        unavailableReason = "Out of Stock";
      }

      // Case 2: Time-based availability
      else if (product.availability === "time-based" && product.availableAfterTime) {
        const now = new Date();
        const [hours, minutes] = product.availableAfterTime.split(":").map(Number);

        const availableTime = new Date();
        availableTime.setHours(hours, minutes, 0, 0);

        if (now < availableTime) {
          isAvailable = false;
          unavailableReason = `Unavailable until ${product.availableAfterTime}`;
        }
      }

      // Case 3: Manually marked out of stock
      else if (product.availability === "out-of-stock") {
        isAvailable = false;
        unavailableReason = "Out of Stock";
      }

      // Case 4: Attributes (variants) check
      if (product.attributes && product.attributes.length > 0) {
        const anyVariantAvailable = product.attributes.some(
          (attr) => attr.isAvailable && attr.stock > 0
        );
        if (!anyVariantAvailable) {
          isAvailable = false;
          unavailableReason = "Out of Stock (All Variants)";
        }
      }

      return {
        ...product.toObject(),
        isAvailable,
        unavailableReason,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      products: formattedProducts,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};






exports.getCatalogByStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    // 1️⃣ Fetch categories for this store
    const categories = await Category.find({ restaurantId: storeId, active: true }).sort({ name: 1 });

    // 2️⃣ Fetch products grouped by category
    const catalog = await Promise.all(
      categories.map(async (category) => {
        const products = await FoodItem.find({
          restaurantId: storeId,
          categoryId: category._id,
        }).sort({ name: 1 });

        return {
          category: {
            id: category._id,
            name: category.name,
          },
          products: products.map((p) => ({
            id: p._id,
            name: p.name,
            description: p.description,
            price: p.price,
            status: p.active ? "Active" : "Inactive",
            foodType: p.foodType, // veg / non-veg
            preparationTime: p.preparationTime,

            // 📌 Availability details
            availability: p.availability, // always / time-based / out-of-stock
            availableAfterTime: p.availableAfterTime, // e.g. "17:00"

            // 📌 Inventory details
            inventoryEnabled: p.enableInventory,
            stock: p.enableInventory ? p.stock : null,
            reorderLevel: p.enableInventory ? p.reorderLevel : null,

            // 📌 Extra details
            image: p.images?.length ? p.images[0] : null,
            rating: p.rating,
        
          })),
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Catalog fetched successfully",
      data: catalog,
    });
  } catch (error) {
    console.error("Error fetching catalog:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};


exports.getCategoriesWithProducts = async (req, res) => {
  const { storeId } = req.params;
  const { search } = req.query;

  if (!storeId) {
    return res.status(400).json({ error: "storeId is required" });
  }

  try {
    const searchRegex = search ? new RegExp(search, "i") : null;

    // Fetch all categories for this store
    let categories = await Category.find({ restaurantId: storeId })
      .sort({ name: 1 })
      .lean();

    // Fetch all products for these categories
    const categoryIds = categories.map(cat => cat._id);
    let products = await Product.find({ categoryId: { $in: categoryIds } })
      .sort({ name: 1 })
      .lean();

    // Combine products under categories
    const categoriesWithProducts = categories
      .map(cat => {
        const catProducts = products.filter(
          p => p.categoryId.toString() === cat._id.toString()
        );

        // Apply search filter
        let filteredProducts = catProducts;
        if (searchRegex) {
          if (searchRegex.test(cat.name)) {
            filteredProducts = catProducts;
          } else {
            filteredProducts = catProducts.filter(p => searchRegex.test(p.name));
          }
        }

        // Include category if it matches search or has matching products
        if (!search || searchRegex.test(cat.name) || filteredProducts.length > 0) {
          return {
            _id: cat._id,
            name: cat.name,
            description: cat.description || "",
            availability: cat.availability,
            sequence: cat.sequence,
            images: cat.images || [],
            active: cat.active,
            restaurantId: cat.restaurantId,
            createdAt: cat.createdAt,
            updatedAt: cat.updatedAt,

            // ✅ Full product details restored
            products: filteredProducts.map(p => ({
              _id: p._id,
              name: p.name,
              description: p.description,
              price: p.price,
              foodType: p.foodType,
              availability: p.availability,
              availableAfterTime: p.availableAfterTime,
              preparationTime: p.preparationTime,
              images: p.images,
              active: p.active,
              enableInventory: p.enableInventory,
              stock: p.stock,
              reorderLevel: p.reorderLevel,
            })),
          };
        }

        return null;
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      categories: categoriesWithProducts,
    });
  } catch (err) {
    console.error("Get categories with products error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};





exports.toggleRestaurantStatus = async (req, res) => {
  try {
    const { storeId, open } = req.body; // frontend sends storeId
    if (!storeId) {
      return res.status(400).json({ success: false, message: "storeId is required" });
    }

    // 1️⃣ Find the store (no owner check)
    const store = await Restaurant.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }

    // 2️⃣ Auto On/Off handling
    const now = new Date();
    const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const today = dayNames[now.getDay()];

    const todayHours = store.openingHours.find(h => h.day === today);

    let isOpen = false;
    if (todayHours && !todayHours.isClosed) {
      const currentTime = `${now.getHours()}`.padStart(2, "0") + ":" + `${now.getMinutes()}`.padStart(2, "0");
      isOpen = currentTime >= todayHours.openingTime && currentTime <= todayHours.closingTime;
    }

    // 3️⃣ Manual override
    if (typeof open === "boolean") {
      store.active = open;
    } else if (store.autoOnOff) {
      store.active = isOpen;
    }

    await store.save();

    res.json({
      success: true,
      message: `Store "${store.name}" is now ${store.active ? "Open" : "Closed"}`,
      active: store.active,
      storeId: store._id
    });

  } catch (error) {
    console.error("Toggle store status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.getStoreStatus = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      return res.status(400).json({ success: false, message: "storeId is required" });
    }

    const store = await Restaurant.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }

    let isOpen = store.active;

    if (store.autoOnOff) {
      const now = new Date();
      const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
      const today = dayNames[now.getDay()];
      const todayHours = store.openingHours.find(h => h.day === today);

      if (todayHours && !todayHours.isClosed) {
        const currentTime = `${now.getHours()}`.padStart(2,"0") + ":" + `${now.getMinutes()}`.padStart(2,"0");
        isOpen = currentTime >= todayHours.openingTime && currentTime <= todayHours.closingTime;
      } else {
        isOpen = false;
      }
    }

    res.json({
      success: true,
      storeId: store._id,
      name: store.name,
      active: store.active,
      currentStatus: isOpen ? "Open" : "Closed"
    });

  } catch (error) {
    console.error("Get store status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};




exports.getMerchantReport = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { range, startDate, endDate } = req.query;

    if (!storeId) {
      return res.status(400).json({ success: false, message: "storeId is required" });
    }

    // 1️⃣ Date Range Setup
    const now = moment().utcOffset("+05:30"); // IST timezone
    let start, end;

    switch (range) {
      case "today":
        start = now.clone().startOf("day");
        end = now.clone().endOf("day");
        break;
      case "week":
        start = now.clone().startOf("week");
        end = now.clone().endOf("week");
        break;
      case "month":
        start = now.clone().startOf("month");
        end = now.clone().endOf("month");
        break;
      case "custom":
        if (!startDate || !endDate) {
          return res
            .status(400)
            .json({ success: false, message: "startDate and endDate required for custom range" });
        }
        start = moment(startDate).startOf("day");
        end = moment(endDate).endOf("day");
        break;
      default:
        // Default to current week
        start = now.clone().startOf("week");
        end = now.clone().endOf("week");
    }

    // 2️⃣ Query Base
    const matchQuery = {
      restaurantId: new mongoose.Types.ObjectId(storeId),
      orderStatus: "delivered",
      createdAt: { $gte: start.toDate(), $lte: end.toDate() },
    };

    // 3️⃣ Fetch Orders
    const orders = await Order.find(matchQuery)
      .populate("customerId", "name")
      .select("subtotal orderItems orderStatus createdAt");

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // 4️⃣ Dynamic Revenue Trend (Hourly / Daily / Datewise)
    let groupByStage = {};
    let labels = [];
    let chartLabelType = "";

    if (range === "today") {
      groupByStage = {
        $group: {
          _id: { $hour: "$createdAt" },
          totalRevenue: { $sum: "$subtotal" },
        },
      };
      labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      chartLabelType = "hourly";
    } else if (range === "week" || !range) {
      groupByStage = {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          totalRevenue: { $sum: "$subtotal" },
        },
      };
      labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      chartLabelType = "daily";
    } else {
      groupByStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalRevenue: { $sum: "$subtotal" },
        },
      };

      const days = [];
      let current = start.clone();
      while (current.isSameOrBefore(end)) {
        days.push(current.format("YYYY-MM-DD"));
        current.add(1, "day");
      }
      labels = days;
      chartLabelType = "datewise";
    }

    const revenueTrendAgg = await Order.aggregate([
      { $match: matchQuery },
      groupByStage,
      { $sort: { _id: 1 } },
    ]);

    const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const revenueTrend = labels.map((label) => {
      const found =
        range === "today"
          ? revenueTrendAgg.find((r) => r._id === parseInt(label))
          : range === "week" || !range
          ? revenueTrendAgg.find((r) => dayMap[r._id - 1] === label)
          : revenueTrendAgg.find((r) => r._id === label);
      return { x: label, amount: found ? found.totalRevenue : 0 };
    });

    // 5️⃣ Top Products
    const topProductsAgg = await Order.aggregate([
      { $match: matchQuery },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.productId",
          name: { $first: "$orderItems.name" },
          totalSold: { $sum: "$orderItems.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
    ]);

    const topProducts = topProductsAgg.map((p, idx) => ({
      name: p.name,
      sold: p.totalSold,
      percent:
        idx === 0 ? 100 : Math.round((p.totalSold / topProductsAgg[0].totalSold) * 100),
    }));

    // 6️⃣ Recent Orders
    const recentOrders = orders
      .slice(-5)
      .reverse()
      .map((o) => ({
        orderId: o._id,
        customer: o.customerId?.name || "Guest",
        items: o.orderItems.length,
        total: o.subtotal,
        status: o.orderStatus,
      }));

    // 7️⃣ Product Performance
    const productPerformanceAgg = await Order.aggregate([
      { $match: matchQuery },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.productId",
          name: { $first: "$orderItems.name" },
          sold: { $sum: "$orderItems.quantity" },
          revenue: { $sum: "$orderItems.totalPrice" },
        },
      },
    ]);

    const products = await Product.find({ restaurantId: storeId })
      .populate("categoryId", "name")
      .lean();

    const productPerformance = products.map((p) => {
      const stats = productPerformanceAgg.find(
        (x) => x._id?.toString() === p._id.toString()
      );
      return {
        name: p.name,
        category: p.categoryId?.name || "Uncategorized",
        sold: stats?.sold || 0,
        revenue: stats?.revenue || 0,
        stock: p.stock || 0,
      };
    });

    // ✅ Final Response
    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        avgOrder,
        chartLabelType, // "hourly" | "daily" | "datewise"
        revenueTrend,
        topProducts,
        recentOrders,
        productPerformance,
      },
    });
  } catch (error) {
    console.error("Merchant Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};







exports.getBasicInfo = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Restaurant.findById(storeId).select(
      "name ownerName phone email address location minOrderAmount preparationTime paymentMethods foodType storeType"
    );
    if (!store) return res.status(404).json({ success: false, message: "Store not found" });
    res.json({ success: true, data: store });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.updateBasicInfo = async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      name,
      phone,
      email,
      address,
      location,
      minOrderAmount,
      preparationTime,
      paymentMethods,
      foodType,
      storeType,
    } = req.body;

    const store = await Restaurant.findById(storeId);
    if (!store) return res.status(404).json({ success: false, message: "Store not found" });

    // Update fields
    if (name) store.name = name;
    if (phone) store.phone = phone;
    if (email) store.email = email;
    if (address) store.address = address;
    if (location) store.location = location;
    if (minOrderAmount !== undefined) store.minOrderAmount = minOrderAmount;
    if (preparationTime !== undefined) store.preparationTime = preparationTime;
    if (paymentMethods) store.paymentMethods = paymentMethods;
    if (foodType) store.foodType = foodType;
    if (storeType) store.storeType = storeType;

    await store.save();
    res.json({ success: true, message: "Basic info updated", data: store });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Get images for a store
exports.getImages = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Restaurant.findById(storeId).select("images banners");
    if (!store)
      return res.status(404).json({ success: false, message: "Store not found" });

    res.json({ success: true, data: { images: store.images, banners: store.banners } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.updateImages = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Restaurant.findById(storeId);
    if (!store)
      return res.status(404).json({ success: false, message: "Store not found" });

    // 🟢 1️⃣ Handle new uploads
    const imageFiles = req.files?.images || [];
    let uploadedImages = [];

    if (imageFiles.length) {
      const results = await Promise.all(
        imageFiles.map((file) =>
          uploadOnCloudinary(file.path, "orado/stores/images")
        )
      );
      uploadedImages = results.map((r) => r.secure_url);
      store.images.push(...uploadedImages);
    }

    // 🔴 2️⃣ Handle deletions
    const removeUrls = req.body.removeUrls
      ? Array.isArray(req.body.removeUrls)
        ? req.body.removeUrls
        : JSON.parse(req.body.removeUrls)
      : [];

    if (removeUrls.length) {
      for (const url of removeUrls) {
        store.images = store.images.filter((img) => img !== url);

        // Optional Cloudinary delete
        const match = url.match(/orado\/stores\/images\/([^\.]+)/);
        if (match && match[1]) {
          const publicId = `orado/stores/images/${match[1]}`;
          await deleteFromCloudinary(publicId);
        }
      }
    }

    await store.save();

    res.json({
      success: true,
      message: "Store images updated successfully",
      data: { images: store.images },
    });
  } catch (err) {
    console.error("Update Images Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getKyc = async (req, res) => {
  try {
    const { storeId } = req.params;
    const restaurant = await Restaurant.findById(storeId).select("kyc kycDocuments kycStatus");

    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }

    res.json({
      success: true,
      data: {
        kyc: restaurant.kyc,
        documents: restaurant.kycDocuments,
     
      },
    });
  } catch (err) {
    console.error("Get KYC Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.updateKyc = async (req, res) => {
  try {
    const { storeId } = req.params;
    const restaurant = await Restaurant.findById(storeId);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }

    // ───────────────────────────────
    // 1️⃣ Basic KYC Fields
    // ───────────────────────────────
    const { fssaiNumber, gstNumber, aadharNumber } = req.body;
    if (fssaiNumber) restaurant.kyc.fssaiNumber = fssaiNumber;
    if (gstNumber) restaurant.kyc.gstNumber = gstNumber;
    if (aadharNumber) restaurant.kyc.aadharNumber = aadharNumber;

    // ───────────────────────────────
    // 2️⃣ Upload New Documents (if any)
    // ───────────────────────────────
    if (req.files) {
      if (req.files.fssaiDoc?.[0]) {
        const result = await uploadOnCloudinary(req.files.fssaiDoc[0].path, "orado/kyc/fssai");
        restaurant.kycDocuments.fssaiDocUrl = result.secure_url;
      }

      if (req.files.gstDoc?.[0]) {
        const result = await uploadOnCloudinary(req.files.gstDoc[0].path, "orado/kyc/gst");
        restaurant.kycDocuments.gstDocUrl = result.secure_url;
      }

      if (req.files.aadharDoc?.[0]) {
        const result = await uploadOnCloudinary(req.files.aadharDoc[0].path, "orado/kyc/aadhar");
        restaurant.kycDocuments.aadharDocUrl = result.secure_url;
      }
    }

    // ───────────────────────────────
    // 3️⃣ Reset status to pending after update
    // ───────────────────────────────
    // restaurant.kycStatus = "pending";

    await restaurant.save();

    res.json({
      success: true,
      message: "KYC details updated successfully",
      data: restaurant.kyc,
      documents: restaurant.kycDocuments,
    });
  } catch (err) {
    console.error("KYC Update Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.getOpeningHours = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Restaurant.findById(storeId).select("openingHours");

    if (!store)
      return res.status(404).json({ success: false, message: "Store not found" });

    res.json({ success: true, data: store.openingHours });
  } catch (err) {
    console.error("Get Opening Hours Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.updateOpeningHours = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { openingHours } = req.body; // expect an array of openingHour objects

    if (!Array.isArray(openingHours)) {
      return res.status(400).json({ success: false, message: "openingHours must be an array" });
    }

    const store = await Restaurant.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }

    // Replace old openingHours with new ones
    store.openingHours = openingHours;

    await store.save();

    res.json({
      success: true,
      message: "Opening hours updated successfully",
      data: store.openingHours,
    });
  } catch (err) {
    console.error("Update Opening Hours Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.updateStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Restaurant.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }

    // ───────────────────────────────
    // 1️⃣ Update Basic Info
    // ───────────────────────────────
    const {
      name,
      phone,
      email,
      address,
      location,
      minOrderAmount,
      preparationTime,
      paymentMethods,
      foodType,
      storeType,
      openingHours,
      kyc,
      removeImageUrls
    } = req.body;

    if (name) store.name = name;
    if (phone) store.phone = phone;
    if (email) store.email = email;
    if (address) store.address = address;

    // ✅ Handle location
    if (location) {
      if (location.type && location.coordinates) {
        store.location = location;
      } else if (location.coordinates) {
        store.location = { type: "Point", coordinates: location.coordinates };
      }
    }

    if (minOrderAmount !== undefined) store.minOrderAmount = minOrderAmount;
    if (preparationTime !== undefined) store.preparationTime = preparationTime;
    if (paymentMethods) store.paymentMethods = paymentMethods;
    if (foodType) store.foodType = foodType;
    if (storeType) store.storeType = storeType;

    // ✅ Handle opening hours
    if (Array.isArray(openingHours)) {
      store.openingHours = openingHours;
    }

    // ───────────────────────────────
    // 2️⃣ Update KYC
    // ───────────────────────────────
    if (kyc) {
      const { fssaiNumber, gstNumber, aadharNumber } = kyc;
      if (fssaiNumber) store.kyc.fssaiNumber = fssaiNumber;
      if (gstNumber) store.kyc.gstNumber = gstNumber;
      if (aadharNumber) store.kyc.aadharNumber = aadharNumber;
    }

    // ✅ Handle KYC documents upload
    if (req.files) {
      if (req.files.fssaiDoc?.[0]) {
        const result = await uploadOnCloudinary(req.files.fssaiDoc[0].path, "orado/kyc/fssai");
        store.kycDocuments.fssaiDocUrl = result.secure_url;
      }
      if (req.files.gstDoc?.[0]) {
        const result = await uploadOnCloudinary(req.files.gstDoc[0].path, "orado/kyc/gst");
        store.kycDocuments.gstDocUrl = result.secure_url;
      }
      if (req.files.aadharDoc?.[0]) {
        const result = await uploadOnCloudinary(req.files.aadharDoc[0].path, "orado/kyc/aadhar");
        store.kycDocuments.aadharDocUrl = result.secure_url;
      }
    }

    // ───────────────────────────────
    // 3️⃣ Update Images
    // ───────────────────────────────
    const imageFiles = req.files?.images || [];
    if (imageFiles.length) {
      const uploadedImages = await Promise.all(
        imageFiles.map((file) => uploadOnCloudinary(file.path, "orado/stores/images"))
      );
      store.images.push(...uploadedImages.map((r) => r.secure_url));
    }

    // Remove images if provided
    if (removeImageUrls) {
      const urlsToRemove = Array.isArray(removeImageUrls) ? removeImageUrls : JSON.parse(removeImageUrls);
      for (const url of urlsToRemove) {
        store.images = store.images.filter((img) => img !== url);
        const match = url.match(/orado\/stores\/images\/([^\.]+)/);
        if (match && match[1]) {
          await deleteFromCloudinary(`orado/stores/images/${match[1]}`);
        }
      }
    }

    await store.save();

    res.json({
      success: true,
      message: "Store updated successfully",
      data: store
    });
  } catch (err) {
    console.error("Update Store Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};




exports.archiveCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (category.archived) {
      return res.status(400).json({ message: "Category already archived" });
    }

    category.archived = true;
    category.archivedAt = new Date();
    await category.save();

    res.status(200).json({ message: "Category archived successfully", category });
  } catch (error) {
    console.error("Error archiving category:", error);
    res.status(500).json({ message: "Server error" });
  }
};



exports.unarchiveCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (!category.archived) {
      return res.status(400).json({ message: "Category is not archived" });
    }

    category.archived = false;
    category.archivedAt = null;
    await category.save();

    res.status(200).json({ message: "Category unarchived successfully", category });
  } catch (error) {
    console.error("Error unarchiving category:", error);
    res.status(500).json({ message: "Server error" });
  }
};




exports.archiveProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.archived) {
      return res.status(400).json({ message: "Product already archived" });
    }

    product.archived = true;
    product.archivedAt = new Date();
    product.active = false; // optional: deactivate archived products

    await product.save();

    res.status(200).json({
      message: "Product archived successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error archiving product:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// ✅ Unarchive Product
exports.unarchiveProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (!product.archived) {
      return res.status(400).json({ message: "Product is not archived" });
    }

    product.archived = false;
    product.archivedAt = null;
    product.active = true; // optional: reactivate after unarchive

    await product.save();

    res.status(200).json({
      message: "Product unarchived successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error unarchiving product:", error);
    res.status(500).json({ message: "Server error", error });
  }
};