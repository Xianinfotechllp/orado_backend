const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Restaurant = require('../models/restaurantModel');


// Create a product


exports.createProduct = async (req, res) => {
  try {
    const restaurantId = req.params.restaurantId?.trim();

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required in params' });
    }



    // Accessing the properties directly from req.body
    const name = req.body.name;
    const price = req.body.price;
    const foodType = req.body.foodType;
    const categoryId = req.body.categoryId;

    // Validate required fields
    if (!name || !price || !foodType || !categoryId) {
      return res.status(400).json({
        error: 'Name, price, foodType, and categoryId are required fields.'
      });
    }

    // Validate restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Check if product with the same name already exists for this restaurant
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

    // Validate category exists and belongs to the same restaurant
    const category = await Category.findOne({ _id: categoryId, restaurantId });
    if (!category) {
      return res.status(404).json({ error: 'Category not found for this restaurant' });
    }

    // Create and save product
    const newProduct = new Product({
      name, 
      price, 
      foodType, 
      categoryId, 
      restaurantId
    });

    await newProduct.save();

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct
    });

  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Internal server error' });
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
    const updated = await Product.findByIdAndUpdate(
      req.params.productId,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
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
