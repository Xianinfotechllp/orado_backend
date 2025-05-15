const mongoose = require('mongoose');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Restaurant = require('../models/restaurantModel');

const { uploadOnCloudinary } = require('../utils/cloudinary');

exports.createProduct = async (req, res) => {
  try {
    const restaurantId = req.params.restaurantId?.trim();

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required in params' });
    }

    const { name, price, foodType, categoryId } = req.body;

    if (!name || !price || !foodType || !categoryId) {
      return res.status(400).json({
        error: 'Name, price, foodType, and categoryId are required fields.'
      });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

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

    const category = await Category.findOne({ _id: categoryId, restaurantId });
    if (!category) {
      return res.status(404).json({ error: 'Category not found for this restaurant' });
    }

    let imageUrl = null;
    if (req.file?.path) {
      const uploaded = await uploadOnCloudinary(req.file.path);
      if (!uploaded) return res.status(500).json({ error: 'Image upload failed' });
      imageUrl = uploaded.secure_url;
    }

    const newProduct = new Product({
      name,
      price,
      foodType,
      categoryId,
      restaurantId,
      images: imageUrl 
    });

    await newProduct.save();

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
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { name, price, foodType, categoryId } = req.body;
    if (name) product.name = name;
    if (price) product.price = price;
    if (foodType) product.foodType = foodType;
    if (categoryId) product.categoryId = categoryId;

    if (req.file?.path) {
      const uploaded = await uploadOnCloudinary(req.file.path);
      if (!uploaded) return res.status(500).json({ error: 'Image upload failed' });
      product.images = uploaded.secure_url;
    }

    await product.save();
    res.json({ message: "Product updated successfully", product });

  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: err.message });
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
