const Cart = require("../models/cartModel")
const Product = require('../models/productModel');
const { calculateOrderCost } = require("../services/orderCostCalculator");



exports.addToCart = async (req, res) => {
  try {
    const { userId, restaurantId, products } = req.body;

    // Basic validations
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "products must be a non-empty array" });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // No cart, create new one
      cart = new Cart({
        userId,
        restaurantId,
        products: []
      });
    } else {
      // Cart exists
      if (cart.restaurantId.toString() !== restaurantId) {
        // Different restaurant, replace cart products and restaurantId
        cart.products = [];
        cart.restaurantId = restaurantId;
      }
    }

    for (const prod of products) {
      if (!prod.productId) {
        // skip invalid product item without productId
        continue;
      }
      const productData = await Product.findById(prod.productId);
      if (!productData) continue; // skip invalid products

      // Confirm product belongs to the requested restaurant
      if (productData.restaurantId.toString() !== restaurantId) {
        // skip products from different restaurant
        continue;
      }

      const index = cart.products.findIndex(p => p.productId.toString() === prod.productId);
      const qtyToAdd = (prod.quantity && prod.quantity > 0) ? prod.quantity : 1;
      const price = productData.price;

      if (index > -1) {
        cart.products[index].quantity += qtyToAdd;
        cart.products[index].total = cart.products[index].quantity * price;
      } else {
        cart.products.push({
          productId: prod.productId,
          name: productData.name,
          price,
          quantity: qtyToAdd,
          total: price * qtyToAdd
        });
      }
    }

    // If no products were added (all invalid/skipped), return error
    if (cart.products.length === 0) {
      return res.status(400).json({ message: "No valid products found to add to cart" });
    }

    // Recalculate totalPrice
    cart.totalPrice = cart.products.reduce((sum, p) => sum + p.total, 0);

    await cart.save();
    res.status(200).json({ message: 'Cart updated', cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};



// Get user's cart
exports.getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await Cart.findOne({ userId: userId });
    if (!cart) {
      return res.status(200).json({ message: "Cart is empty", cart: { items: [] } });
    }

    res.status(200).json(cart);
  } catch (error) {
    console.error("Get Cart Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update item quantity
exports.updateCartItem = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || quantity == null) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex === -1) return res.status(404).json({ message: "Item not found in cart" });

    const pricePerUnit = cart.items[itemIndex].priceAtPurchase;
    const oldQty = cart.items[itemIndex].quantity;

    cart.items[itemIndex].quantity = quantity;

    // Update totals
    cart.totalQuantity += quantity - oldQty;
    cart.totalPrice += (quantity - oldQty) * pricePerUnit;

    await cart.save();

    res.status(200).json({ message: "Cart item updated", cart });
  } catch (error) {
    console.error("Update Cart Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res) => {
  try {
    const { userId, productId } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex === -1) return res.status(404).json({ message: "Item not found in cart" });

    const item = cart.items[itemIndex];
    cart.totalPrice -= item.priceAtPurchase * item.quantity;
    cart.totalQuantity -= item.quantity;

    cart.items.splice(itemIndex, 1);
    await cart.save();

    res.status(200).json({ message: "Item removed from cart", cart });
  } catch (error) {
    console.error("Remove from Cart Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Clear entire cart
exports.clearCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items = [];
    cart.totalPrice = 0;
    cart.totalQuantity = 0;
    cart.lastUpdated = new Date();

    await cart.save();

    res.status(200).json({ message: "Cart cleared", cart });
  } catch (error) {
    console.error("Clear Cart Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
