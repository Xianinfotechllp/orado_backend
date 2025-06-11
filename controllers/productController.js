const mongoose = require('mongoose');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Restaurant = require('../models/restaurantModel');
const Permission = require('../models/restaurantPermissionModel');
const ChangeRequest = require('../models/changeRequest');

const { isValidObjectId } = mongoose;
const { uploadOnCloudinary } = require('../utils/cloudinary');
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      categoryId,
      foodType,
      addOns = [],
      specialOffer = {},
      attributes = [],
      unit = "piece",
      stock = 0,
      reorderLevel = 0,
      revenueShare = { type: "percentage", value: 10 }
    } = req.body;

    const { restaurantId } = req.params;
  

    // Validate required fields           
    if (!name || !price || !categoryId || !restaurantId || !foodType) {
      return res.status(400).json({
        success: false,
        message: "name, price, categoryId, restaurantId and foodType are required fields"
      });
    }

    // Validate ObjectIds
    if (!mongoose.isValidObjectId(restaurantId)) {
      return res.status(400).json({ success: false, message: "Invalid restaurant ID format" });
    }

    if (!mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({ success: false, message: "Invalid category ID format" });
    }

    // Validate food type
    if (!["veg", "non-veg"].includes(foodType)) {
      return res.status(400).json({
        success: false,
        message: 'Food type must be either "veg" or "non-veg"'
      });
    }

    // Upload images to Cloudinary
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploadResults = await Promise.all(
        req.files.map(file => uploadOnCloudinary(file.path, "restaurant_products"))
      );

      imageUrls = uploadResults
        .filter(result => result?.secure_url)
        .map(result => result.secure_url);
    }

    // Create Product
    const newProduct = await Product.create({
      name: name.trim(),
      description: description?.trim(),
      price: parseFloat(price),
      categoryId,
      restaurantId,
      images: imageUrls,
      foodType,
      addOns,
      attributes,
      unit,
      stock: parseInt(stock),
      reorderLevel: parseInt(reorderLevel),
      revenueShare
    });

    const response = newProduct.toObject();
    delete response.__v;

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: response
    });

  } catch (error) {
    console.error("Error creating product:", error);

    if (req.files?.length) {
      await Promise.all(req.files.map(file =>
        fs.promises.unlink(file.path).catch(console.error)
      ));
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// Update a product;


exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(productId)
    // Find the existing product
    const product = await Product.findOne({_id:productId});
    console.log(product)
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const {
      name,
      description,
      price,
      categoryId,
      foodType,
      addOns,
      attributes,
      unit,
      stock,
      reorderLevel,
      revenueShare,
      replaceImageIndex  // index of the image to replace (optional)
    } = req.body;

    // Update fields only if they exist in req.body
    if (name) product.name = name.trim();
    if (description) product.description = description.trim();
    if (price) product.price = parseFloat(price);
    if (categoryId) product.categoryId = categoryId;
    if (foodType) product.foodType = foodType;
    if (addOns) product.addOns = addOns;
    if (attributes) product.attributes = attributes;
    if (unit) product.unit = unit;
    if (stock) product.stock = parseInt(stock);
    if (reorderLevel) product.reorderLevel = parseInt(reorderLevel);
    if (revenueShare) product.revenueShare = revenueShare;

    // Handle image upload & replacement
    if (req.files && req.files.length > 0) {
      // For simplicity, handle one image replacement at a time
      const uploadResult = await uploadOnCloudinary(req.files[0].path, 'restaurant_products');

      if (uploadResult?.secure_url) {
        const newImageUrl = uploadResult.secure_url;

        if (replaceImageIndex !== undefined && !isNaN(replaceImageIndex)) {
          const idx = parseInt(replaceImageIndex);
          if (idx >= 0 && idx < product.images.length) {
            // Replace existing image at index
            product.images[idx] = newImageUrl;
          } else {
            // Index invalid, append new image instead
            product.images.push(newImageUrl);
          }
        } else {
          // No replace index provided, append new image(s)
          product.images.push(newImageUrl);
        }
      }
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });

  } catch (error) {
    console.error('Error updating product:', error);

    // Cleanup uploaded files on error
    if (req.files?.length) {
      await Promise.all(req.files.map(file =>
        fs.promises.unlink(file.path).catch(console.error)
      ));
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all products for the logged-in restaurant
// @route   GET /api/products/my-restaurant
// @access  Private (Restaurant owner/admin)
exports.getMyRestaurantProducts = async (req, res) => {
  try {
    // Assuming the restaurant ID is stored in req.user.restaurantId after authentication
    const restaurantId = req.user.restaurantId;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false,
        error: 'User is not associated with any restaurant' 
      });
    }

    // Find the restaurant first to verify it exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ 
        success: false,
        error: 'Restaurant not found' 
      });
    }

    // Get all products for this restaurant
    // You can populate category if needed
    const products = await Product.find({ restaurantId })
      .populate('categoryId', 'name') // Optional: populate category name
      .sort({ createdAt: -1 }); // Sort by newest first

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (err) {
    console.error('Error fetching restaurant products:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};





// Get products for a restaurant
exports.getRestaurantProducts = async (req, res) => {
  try {
    const products = await Product.find({ restaurantId: req.params.restaurantId });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a product;

// exports.updateProduct = async (req, res) => {
//   try {
//     const { productId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(productId)) {
//       return res.status(400).json({ error: 'Invalid product ID' });
//     }
//     if (!req.body || typeof req.body !== 'object') {
//       return res.status(400).json({ error: 'Invalid request body' });
//     }

//     const product = await Product.findById(productId);
//     if (!product) {
//       return res.status(404).json({ error: 'Product not found' });
//     }

//     const restaurant = await Restaurant.findById(product.restaurantId);
//     if (!restaurant) {
//       return res.status(404).json({ error: 'Restaurant not found' });
//     }

//     // Pre-upload images even if user might not have permission
//     let newImageUrls = [];
//     if (req.files && req.files.length > 0) {
//       for (const file of req.files) {
//         const uploaded = await uploadOnCloudinary(file.path);
//         if (uploaded?.secure_url) {
//           newImageUrls.push(uploaded.secure_url);
//         }
//       }
//     }

//     const updatePayload = {
//       ...(req.body.name && { name: req.body.name }),
//       ...(req.body.price && { price: req.body.price }),
//       ...(req.body.description && { description: req.body.description }),
//       ...(req.body.foodType && { foodType: req.body.foodType }),
//       ...(req.body.categoryId && { categoryId: req.body.categoryId }),
//       ...(req.body.unit && { unit: req.body.unit }),
//       ...(req.body.stock && { stock: req.body.stock }),
//       ...(req.body.reorderLevel && { reorderLevel: req.body.reorderLevel }),
//       ...(req.body.attributes && { attributes: req.body.attributes }),
//       ...(req.body.addOns && { addOns: req.body.addOns }),
//       ...(req.body.specialOffer && { specialOffer: req.body.specialOffer }),
//       ...(newImageUrls.length > 0 && { images: newImageUrls }),
//     };

//     if (!canManageMenu) {
//       // Save this as a ChangeRequest
//       await ChangeRequest.create({
//         restaurantId: restaurant._id,
//         requestedBy: req.user._id,
//         type: "MENU_CHANGE",
//         data: {
//           action: "UPDATE_PRODUCT",
//           productId: productId,
//           payload: updatePayload
//         },
//         note: `User requested to update product "${product.name}" without permission.`
//       });

//       return res.status(403).json({
//         message: `You don't have permission to update products. We've sent your request to the admin.`
//       });
//     }

//     // User has permission, apply updates directly
//     Object.assign(product, updatePayload);

//     await product.save();

//     res.json({
//       message: 'Product updated successfully',
//       product
//     });

//   } catch (err) {
//     console.error('Update error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };





// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const restaurant = await Restaurant.findById(product.restaurantId);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    const permissionDoc = await Permission.findOne({ restaurantId: restaurant._id });
    const canManageMenu = permissionDoc?.permissions?.canManageMenu || false;

    if (!canManageMenu) {
      await ChangeRequest.create({
        restaurantId: restaurant._id,
        requestedBy: req.user._id,
        type: "MENU_CHANGE",
        data: {
          action: "DELETE_PRODUCT",
          productId,
          productSnapshot: {
            name: product.name,
            price: product.price,
            categoryId: product.categoryId,
          }
        },
        note: `User requested to delete product "${product.name}" without permission.`
      });

      return res.status(403).json({
        message: "You don't have permission to delete products. Admin has been notified."
      });
    }

    await Product.findByIdAndDelete(productId);

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.toggleProductActive = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const restaurant = await Restaurant.findById(product.restaurantId);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    const permissionDoc = await Permission.findOne({ restaurantId: restaurant._id });
    const canManageMenu = permissionDoc?.permissions?.canManageMenu || false;

    if (!canManageMenu) {
      await ChangeRequest.create({
        restaurantId: restaurant._id,
        requestedBy: req.user._id,
        type: "MENU_CHANGE",
        data: {
          action: "TOGGLE_PRODUCT_ACTIVE",
          productId,
          productSnapshot: {
            name: product.name,
            price: product.price,
            categoryId: product.categoryId,
          },
          currentStatus: product.active
        },
        note: `User requested to toggle product "${product.name}" active status without permission.`
      });

      return res.status(403).json({
        message: "You don't have permission to change product status. Admin has been notified."
      });
    }

    product.active = !product.active;
    await product.save();

    res.json({ message: `Product is now ${product.active ? 'active' : 'inactive'}` });
  } catch (err) {
    console.error('Toggle active error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



exports.getCategoryProducts = async (req, res) => {
  try {
    const { restaurantId, categoryId } = req.params;

    // Validate IDs
    if (!isValidObjectId(restaurantId) || !isValidObjectId(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid restaurant or category ID'
      });
    }

    // Find all active products in this category and restaurant
    const products = await Product.find({
      restaurantId,
      categoryId
    })
    .sort({ name: 1 }) // Sort alphabetically

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



