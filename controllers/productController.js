const mongoose = require('mongoose');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Restaurant = require('../models/restaurantModel');
const Permission = require('../models/restaurantPermissionModel');
const ChangeRequest = require('../models/changeRequest');


const { uploadOnCloudinary } = require('../utils/cloudinary');

exports.createProduct = async (req, res) => {
  try {
    const { restaurantId } = req.params;
     

    if (!restaurantId?.trim()) {
      return res.status(400).json({ error: 'Restaurant ID is required in params' });
    }

    const {
      name,
      price,
      description,
      foodType,
      categoryId,
      attributes = [],
      addOns = [],
      specialOffer = {},
      unit = 'piece',
      stock = 0,
      reorderLevel = 0
    } = req.body;

    // Mandatory fields validation
    if (!name?.trim() || !price || !foodType || !categoryId) {
      return res.status(400).json({
        error: 'Name, price, foodType, and categoryId are required fields.'
      });
    }

    // Restaurant validation
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Permission check
    const permissionDoc = await Permission.findOne({ restaurantId });
    const canManageMenu = permissionDoc?.permissions?.canManageMenu || false;

    if (!canManageMenu) {
      await ChangeRequest.create({
        restaurantId,
        requestedBy: req.user._id,
        type: "MENU_CHANGE",
        data: {
          action: "CREATE_PRODUCT",
          payload: {
            name,
            price,
            description,
            foodType,
            categoryId,
            attributes,
            addOns,
            specialOffer,
            unit,
            stock,
            reorderLevel,
            images: req.files?.map(file => file.path) || []
          }
        },
        note: `Requested to create product "${name}" without permission`
      });

      return res.status(403).json({
        message: `You don't have permission to manage the menu. Your request has been sent to the admin.`
      });
    }

    // Category validation
    const category = await Category.findOne({ _id: categoryId, restaurantId });
    if (!category) {
      return res.status(404).json({ error: 'Category not found for this restaurant' });
    }

    // Duplicate product check
    const existingProduct = await Product.findOne({
      name: name.trim(),
      restaurantId,
      categoryId
    });
    if (existingProduct) {
      return res.status(400).json({
        message: 'A product with the same name already exists in this category for this restaurant.'
      });
    }

    // Handle image uploads if files provided
    let imageUrls = [];
    if (req.files?.length > 0) {
      const uploads = await Promise.all(
        req.files.map(file => uploadOnCloudinary(file.path))
      );

      imageUrls = uploads
        .filter(upload => upload?.secure_url)
        .map(upload => upload.secure_url);
    }

    // Create product
    const newProduct = await Product.create({
      name: name.trim(),
      description,
      price,
      foodType,
      categoryId,
      restaurantId,
      images: imageUrls,
      attributes,
      addOns,
      specialOffer,
      unit,
      stock,
      reorderLevel
    });

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct
    });

  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Internal server error' });
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

exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const restaurant = await Restaurant.findById(product.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const permissionDoc = await Permission.findOne({ restaurantId: restaurant._id });
    const canManageMenu = permissionDoc?.permissions?.canManageMenu || false;

    // Pre-upload images even if user might not have permission
    let newImageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadOnCloudinary(file.path);
        if (uploaded?.secure_url) {
          newImageUrls.push(uploaded.secure_url);
        }
      }
    }

    const updatePayload = {
      ...(req.body.name && { name: req.body.name }),
      ...(req.body.price && { price: req.body.price }),
      ...(req.body.description && { description: req.body.description }),
      ...(req.body.foodType && { foodType: req.body.foodType }),
      ...(req.body.categoryId && { categoryId: req.body.categoryId }),
      ...(req.body.unit && { unit: req.body.unit }),
      ...(req.body.stock && { stock: req.body.stock }),
      ...(req.body.reorderLevel && { reorderLevel: req.body.reorderLevel }),
      ...(req.body.attributes && { attributes: req.body.attributes }),
      ...(req.body.addOns && { addOns: req.body.addOns }),
      ...(req.body.specialOffer && { specialOffer: req.body.specialOffer }),
      ...(newImageUrls.length > 0 && { images: newImageUrls }),
    };

    if (!canManageMenu) {
      // Save this as a ChangeRequest
      await ChangeRequest.create({
        restaurantId: restaurant._id,
        requestedBy: req.user._id,
        type: "MENU_CHANGE",
        data: {
          action: "UPDATE_PRODUCT",
          productId: productId,
          payload: updatePayload
        },
        note: `User requested to update product "${product.name}" without permission.`
      });

      return res.status(403).json({
        message: `You don't have permission to update products. We've sent your request to the admin.`
      });
    }

    // User has permission, apply updates directly
    Object.assign(product, updatePayload);

    await product.save();

    res.json({
      message: 'Product updated successfully',
      product
    });

  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};





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
          productId
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




