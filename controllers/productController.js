const mongoose = require('mongoose');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Restaurant = require('../models/restaurantModel');

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

    // Category validation
    const category = await Category.findOne({ _id: categoryId, restaurantId });
    if (!category) {
      return res.status(404).json({ error: 'Category not found for this restaurant' });
    }

    // Check for duplicate product name in category
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

// Update a product
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const {
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
      reorderLevel
    } = req.body;

    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = price;
    if (foodType) product.foodType = foodType;
    if (categoryId) product.categoryId = categoryId;
    if (unit) product.unit = unit;
    if (stock) product.stock = stock;
    if (reorderLevel) product.reorderLevel = reorderLevel;
    if (attributes) product.attributes = attributes;
    if (addOns) product.addOns = addOns;
    if (specialOffer) product.specialOffer = specialOffer;

    if (req.files && req.files.length > 0) {
      let newImageUrls = [];
      for (const file of req.files) {
        const uploaded = await uploadOnCloudinary(file.path);
        if (uploaded?.secure_url) {
          newImageUrls.push(uploaded.secure_url);
        }
      }
      product.images = newImageUrls;
    }

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
    await Product.findByIdAndDelete(req.params.productId);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Toggle product active status
exports.toggleProductActive = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.active = !product.active;
    await product.save();

    res.json({ message: `Product is now ${product.active ? 'active' : 'inactive'}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
