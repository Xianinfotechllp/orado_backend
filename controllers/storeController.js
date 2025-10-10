// controllers/storeController.js
const Restaurant =  require('../models/restaurantModel');
const Category = require("../models/categoryModel")
const Product = require("../models/productModel")
const { uploadOnCloudinary } = require("../utils/cloudinary");
const fs = require("fs");
const User = require("../models/userModel");
const xlsx = require("xlsx");
const ExcelJS = require("exceljs");


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
    // For FormData, we need to handle both body fields and files
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
      foodType,
      unit,
      enableInventory,
      stock,
      reorderLevel,
      costPrice,
      minimumOrderQuantity,
      maximumOrderQuantity
    } = req.body;

    console.log('Received body:', req.body);
    
    // Convert string values to appropriate types
    const numericFields = {
      price: parseFloat(price),
      preparationTime: parseInt(preparationTime) || 10,
      stock: parseInt(stock) || 0,
      reorderLevel: parseInt(reorderLevel) || 0,
      costPrice: parseFloat(costPrice) || 0,
      minimumOrderQuantity: parseInt(minimumOrderQuantity) || 1,
      maximumOrderQuantity: parseInt(maximumOrderQuantity) || 100
    };

    // Validate required fields
    if (!name || !price || !categoryId || !storeId || !foodType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate numeric fields
    if (isNaN(numericFields.price)) {
      return res.status(400).json({ message: "Price must be a valid number" });
    }

    if (numericFields.minimumOrderQuantity < 1 || numericFields.maximumOrderQuantity < 1) {
      return res.status(400).json({ message: "Min and max quantity must be greater than 0" });
    }

    if (numericFields.maximumOrderQuantity < numericFields.minimumOrderQuantity) {
      return res.status(400).json({ message: "Max quantity must be >= min quantity" });
    }

    // Handle image uploads
    let images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await uploadOnCloudinary(file.path, 'product_images');
        if (uploadResult?.secure_url) {
          images.push(uploadResult.secure_url);
        }
      }
    }

    // Create product
    const newProduct = new Product({
      name,
      description: description || '',
      price: numericFields.price,
      categoryId,
      restaurantId: storeId,
      images,
      active: active !== undefined ? active : true,
      preparationTime: numericFields.preparationTime,
      availability: availability || 'always',
      availableAfterTime: availability === 'time-based' ? availableAfterTime : null,
      foodType,
      addOns: [],
      specialOffer: {
        discount: 0,
        startDate: null,
        endDate: null
      },
      rating: 0,
      attributes: [],
      unit: unit || 'piece',
      enableInventory: enableInventory === 'true' || false,
      stock: numericFields.stock,
      reorderLevel: numericFields.reorderLevel,
      revenueShare: {
        type: 'percentage',
        value: 10
      },
      costPrice: numericFields.costPrice,
      minimumOrderQuantity: numericFields.minimumOrderQuantity,
      maximumOrderQuantity: numericFields.maximumOrderQuantity
    });

    await newProduct.save();

    return res.status(201).json({
      message: "Product created successfully",
      data: newProduct
    });

  } catch (err) {
    console.error("Error storing product:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const existingProduct = await Product.findById(id);

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    const body = req.body;

    // Convert number fields safely
    const numericFields = {
      price: body.price ? parseFloat(body.price) : undefined,
      preparationTime: body.preparationTime ? parseInt(body.preparationTime) : undefined,
      stock: body.stock ? parseInt(body.stock) : undefined,
      reorderLevel: body.reorderLevel ? parseInt(body.reorderLevel) : undefined,
      costPrice: body.costPrice ? parseFloat(body.costPrice) : undefined,
      minimumOrderQuantity: body.minimumOrderQuantity ? parseInt(body.minimumOrderQuantity) : undefined,
      maximumOrderQuantity: body.maximumOrderQuantity ? parseInt(body.maximumOrderQuantity) : undefined
    };

    // Prepare updates
    const updates = {};

    if (body.name) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (!isNaN(numericFields.price)) updates.price = numericFields.price;
    if (body.categoryId) updates.categoryId = body.categoryId;
    if (body.storeId) updates.restaurantId = body.storeId;
    if (body.active !== undefined) updates.active = body.active === 'true';
    if (!isNaN(numericFields.preparationTime)) updates.preparationTime = numericFields.preparationTime;
    if (body.availability) updates.availability = body.availability;
    if (body.availability === 'time-based') updates.availableAfterTime = body.availableAfterTime;
    if (body.foodType) updates.foodType = body.foodType;
    if (body.unit) updates.unit = body.unit;
    if (body.enableInventory !== undefined) updates.enableInventory = body.enableInventory === 'true';
    if (!isNaN(numericFields.stock)) updates.stock = numericFields.stock;
    if (!isNaN(numericFields.reorderLevel)) updates.reorderLevel = numericFields.reorderLevel;
    if (!isNaN(numericFields.costPrice)) updates.costPrice = numericFields.costPrice;
    if (!isNaN(numericFields.minimumOrderQuantity)) updates.minimumOrderQuantity = numericFields.minimumOrderQuantity;
    if (!isNaN(numericFields.maximumOrderQuantity)) updates.maximumOrderQuantity = numericFields.maximumOrderQuantity;

    // Handle image removal
    let finalImages = existingProduct.images || [];
    if (body.imagesToRemove) {
      const imagesToRemove = JSON.parse(body.imagesToRemove); // send as JSON string from frontend
      finalImages = finalImages.filter(img => !imagesToRemove.includes(img));
    }

    // Upload new images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadOnCloudinary(file.path, 'product_images');
        if (uploaded?.secure_url) {
          finalImages.push(uploaded.secure_url);
        }
      }
    }

    updates.images = finalImages;

    // Final update
    const updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true });

    return res.status(200).json({
      message: "Product updated successfully",
      data: updatedProduct
    });

  } catch (err) {
    console.error("Error updating product:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};








// Create Category
exports.createCategory = async (req, res) => {
  try {
    const {
      name,
      restaurantId,
      availability,
      availableAfterTime,
      description,
      active,
      autoOnOff
    } = req.body;

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
      restaurantId,
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
      availableAfterTime,
      description,
      active,
      restaurantId, // optional
      autoOnOff,
      imagesToRemove = [],
    } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Remove selected images
    if (imagesToRemove.length) {
      category.images = category.images.filter(img => !imagesToRemove.includes(img));
    }

    // Upload new images
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const uploadedUrl = await uploadOnCloudinary(file.path);
        if (uploadedUrl) category.images.push(uploadedUrl);
        fs.unlinkSync(file.path);
      }
    }

    // Update fields conditionally
    category.name = name ?? category.name;
    category.availability = availability ?? category.availability;
    category.availableAfterTime = availableAfterTime ?? category.availableAfterTime;
    category.description = description ?? category.description;
    category.active = active ?? category.active;
    category.autoOnOff = autoOnOff ?? category.autoOnOff;
    if (restaurantId) category.restId = restaurantId;

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

        const updateData = {
          name: row["Product Name"],
          description: row["Description"],
          price: Number(row["Price"]) || 0,
          categoryId: row["Category ID"]
            ? String(row["Category ID"]).trim().replace(/^"|"$/g, "")
            : null,
          foodType: row["Food Type"]?.toLowerCase(),
          active: row["Status"] === "Active",
          availability: row["Availability"] || "always",
          availableAfterTime: row["Available After Time"] || null,
          preparationTime: Number(row["Preparation Time (mins)"]) || 10,
          enableInventory: row["Has Inventory"] === "Yes",
          stock: Number(row["Stock"]) || 0,
          images: row["Images"]
            ? row["Images"].split(",").map((s) => s.trim())
            : [],
        };

        const updated = await Product.findByIdAndUpdate(productId, updateData, {
          new: true, // return the updated document
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
      message: "Bulk update completed",
      updatedCount,
      updatedProducts, // 👈 send back updated products
      errors,
    });
  } catch (error) {
    console.error("Bulk Edit Products Error:", error);
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
            image: cat.image || null,
            active: cat.active,
            restaurantId: cat.restaurantId,
            createdAt: cat.createdAt,
            updatedAt: cat.updatedAt,
            // ✅ Only include minimal product details
            products: filteredProducts.map(p => ({
              _id: p._id,
              name: p.name,
              images: p.images,
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
