const Cart = require("../models/cartModel")
const Product = require('../models/productModel');
const mongoose = require('mongoose')

exports.addToCart = async (req, res) => {
  const userId = req.user._id;
  const { restaurantId, products } = req.body;

  try {
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw { status: 400, message: "Invalid userId format" };
    }
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      throw { status: 400, message: "Invalid restaurantId format" };
    }

    // Find existing cart or create new
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, restaurantId, products: [] });
    } else if (cart.restaurantId.toString() !== restaurantId) {
      cart.products = [];
      cart.restaurantId = restaurantId;
    }

    if (products && Array.isArray(products)) {
      for (const prod of products) {
        if (!prod.productId || !mongoose.Types.ObjectId.isValid(prod.productId)) continue;

        const productData = await Product.findById(prod.productId);
        if (!productData || productData.restaurantId.toString() !== restaurantId) continue;

        const index = cart.products.findIndex(p => p.productId.toString() === prod.productId);

        if (prod.quantity === 0) {
          if (index > -1) {
            cart.products.splice(index, 1);
          }
        } else {
          const newQty = prod.quantity > 0 ? prod.quantity : 1;
          const price = productData.price;

          if (index > -1) {
            cart.products[index].quantity = newQty;
            cart.products[index].total = newQty * price;
          } else {
            cart.products.push({
              productId: prod.productId,
              name: productData.name,
              price,
              quantity: newQty,
              total: price * newQty
            });
          }
        }
      }
    }

    // If cart is now empty → clear total price and optionally delete cart document if you prefer
    if (cart.products.length === 0) {
      cart.totalPrice = 0;
      await cart.save();
      return res.status(200).json({
        success: true,
        message: "Cart cleared",
        cart
      });
    }

    // Calculate total price
    cart.totalPrice = cart.products.reduce((sum, p) => sum + p.total, 0);
    await cart.save();

    return res.status(200).json({
      success: true,
      messageType: "success",
      message: "Cart updated successfully",
      cart
    });

  } catch (error) {
    console.error("Error inside addToCart service:", error);
    res.status(error.status || 500).json({ message: error.message || "Something went wrong" });
  }
};

// Get user's cart
exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ user: userId }).populate("products.productId");
    if (!cart) {
      return res.status(200).json({ message: "Cart is empty", cart: { products: [] } });
    }
    res.status(200).json(cart);
  } catch (error) {
    console.error("Get Cart Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity } = req.body;

    if (!userId || !productId || quantity == null) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const itemIndex = cart.products.findIndex(item => item.productId.toString() === productId);
    if (itemIndex === -1) return res.status(404).json({ message: "Item not found in cart" });

    const productData = await Product.findById(productId);
    if (!productData) return res.status(404).json({ message: "Product not found" });

    const price = productData.price;
    cart.products[itemIndex].quantity = quantity;
    cart.products[itemIndex].total = quantity * price;

    cart.totalPrice = cart.products.reduce((sum, p) => sum + p.total, 0);
    await cart.save();

    res.status(200).json({ message: "Cart item updated", cart });
  } catch (error) {
    console.error("Update Cart Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const itemIndex = cart.products.findIndex(item => item.productId.toString() === productId);
    if (itemIndex === -1) return res.status(404).json({ message: "Item not found in cart" });

    cart.products.splice(itemIndex, 1);
    cart.totalPrice = cart.products.reduce((sum, p) => sum + p.total, 0);
    await cart.save();

    res.status(200).json({ message: "Item removed from cart", cart });
  } catch (error) {
    console.error("Remove from Cart Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const updatedCart = await Cart.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          products: [],
          totalPrice: 0,
          lastUpdated: new Date()
        }
      },
      { new: true }
    );

    if (!updatedCart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      cart: updatedCart
    });
  } catch (error) {
    console.error("Clear Cart Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message
    });
  }
};
