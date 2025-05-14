const Product = require('../models/productModel'); // Assuming FoodItem is the model name

// Create a product
exports.createProduct = async (req, res) => {
  try {
    const restaurantId = req.params.restaurantId.trim()
    console.log(restaurantId)
    if (!req.body.name || !req.body.price || !req.body.foodType) {
        console.log(req.body.name)
  return res.status(400).json({ error: 'Name, price, and food type are required' });
}
    const newProduct = new Product({ ...req.body, restaurantId });
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
