// controllers/storeController.js
const Restaurant =  require('../models/restaurantModel');
const Category = require("../models/categoryModel")
const Product = require("../models/productModel")
const { uploadOnCloudinary } = require("../utils/cloudinary");
const fs = require("fs");
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
    const { restaurantId } = req.body; // or use req.query.restaurantId if coming from query

    if (!restaurantId) {
      return res.status(400).json({ message: 'Restaurant ID is required.' });
    }

    const product = await Product.findOne({ _id: productId, restaurantId });

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

