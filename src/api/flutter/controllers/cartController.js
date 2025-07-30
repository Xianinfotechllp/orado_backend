const Cart = require("../../../../models/cartModel")
const Product = require('../../../../models/productModel');
const { calculateOrderCost } = require("../services/orderCostCalculator");
const Restaurant = require("../../../../models/restaurantModel");
const mongoose = require('mongoose')



exports.addToCart = async (req, res) => {
  const userId = req.user._id;
  const { restaurantId, products } = req.body;

  try {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format", messageType: "failure" });
    }
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurantId format", messageType: "failure" });
    }
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Products must be a non-empty array", messageType: "failure" });
    }

    // Get existing cart or create new one
let cart = await Cart.findOne({ user: userId }).populate('restaurantId', 'name');

    if (!cart) {
      cart = new Cart({
        user: userId,
        restaurantId,
        products: []
      });
    } else if (cart.restaurantId.toString() !== restaurantId) {
      // Clear cart if restaurant has changed
      cart.products = [];
      cart.restaurantId = restaurantId;
    }

    // Process each product
    for (const prod of products) {
      if (!prod.productId || !mongoose.Types.ObjectId.isValid(prod.productId)) continue;

      const index = cart.products.findIndex(p => p.productId.toString() === prod.productId);

      if (prod.quantity === 0) {
        // Remove product if quantity is 0
        if (index > -1) cart.products.splice(index, 1);
        continue;
      }

      // Fetch product data
      const productData = await Product.findById(prod.productId);
      if (!productData || productData.restaurantId.toString() !== restaurantId) continue;

      const newQty = prod.quantity > 0 ? prod.quantity : 1;
      const price = productData.price;

      if (index > -1) {
        // Update existing product in cart
        cart.products[index].quantity = newQty;
        cart.products[index].total = newQty * price;
      } else {
        // Add new product to cart
        cart.products.push({
          productId: prod.productId,
          name: productData.name,
          description: productData.description,
           images: productData.images || [], // ✅ single image string with field name "images"
          foodType: productData.foodType,
          price,
          quantity: newQty,
          total: price * newQty
        });
      }
    }

    // Handle empty cart
    if (cart.products.length === 0) {
      cart.totalPrice = 0;
      await cart.save();

      return res.status(200).json({
        message: "Cart is now empty",
        messageType: "success",
        data: {
          cartId: cart._id.toString(),
          userId: cart.user.toString(),
          restaurantId: cart.restaurantId,
          restaurantName: cart.restaurantId.name,
          products: [],
          totalPrice: 0,
          createdAt: cart.createdAt,
          updatedAt: cart.updatedAt
        }
      });
    }

    // Compute total price
    cart.totalPrice = cart.products.reduce((sum, p) => sum + p.total, 0);
    await cart.save();

    const cartData = {
      cartId: cart._id.toString(),
      userId: cart.user.toString(),
      restaurantId: cart.restaurantId,
      products: cart.products,
      totalPrice: cart.totalPrice,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt
    };

    return res.status(200).json({
      message: "Cart updated successfully",
      messageType: "success",
      data: cartData
    });

  } catch (error) {
    console.error("Error inside addToCart service:", error);
    return res.status(500).json({
      message: error.message || "Something went wrong",
      messageType: "failure"
    });
  }
};




exports.decreaseProductQuantity = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format", messageType: "failure" });
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId format", messageType: "failure" });
    }

    // Find cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found", messageType: "failure" });
    }

    // Find product in cart
    const index = cart.products.findIndex(p => p.productId.toString() === productId);
    if (index === -1) {
      return res.status(404).json({ message: "Product not found in cart", messageType: "failure" });
    }

    // Decrease quantity or remove product
    const product = cart.products[index];
    if (product.quantity > 1) {
      product.quantity -= 1;
      product.total = product.quantity * product.price;
    } else {
      cart.products.splice(index, 1);
    }

    // Update total price
    cart.totalPrice = cart.products.reduce((sum, p) => sum + p.total, 0);

    await cart.save();

    // Prepare response
    const cartObj = cart.toObject();
    const cartData = {
      cartId: cartObj._id.toString(),
      userId: cartObj.user.toString(),
      restaurantId: cartObj.restaurantId,
      products: cartObj.products,
      totalPrice: cartObj.totalPrice,
      createdAt: cartObj.createdAt,
      updatedAt: cartObj.updatedAt,
    };

    return res.status(200).json({
      message: "Product quantity updated successfully",
      messageType: "success",
      data: cartData
    });

  } catch (error) {
    console.error("Error decreasing product quantity:", error);
    return res.status(500).json({
      message: "Internal server error",
      messageType: "failure"
    });
  }
};


exports.addToCartOneByOne = async (req, res) => {
  const userId = req.user._id;
  const { restaurantId, productId, quantity } = req.body;

  try {
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw { status: 400, message: "Invalid userId format" };
    }
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      throw { status: 400, message: "Invalid restaurantId format" };
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw { status: 400, message: "Invalid productId format" };
    }

    const productData = await Product.findById(productId);
    if (!productData) {
      throw { status: 404, message: "Product not found" };
    }
    if (productData.restaurantId.toString() !== restaurantId) {
      throw { status: 400, message: "Product does not belong to the selected restaurant" };
    }

    let cart = await Cart.findOne({ user: userId });

    // Create cart if it doesn't exist
    if (!cart) {
      cart = new Cart({
        user: userId,
        restaurantId,
        products: []
      });
    } else if (cart.restaurantId.toString() !== restaurantId) {
      // Clear cart if switching restaurant
      cart.products = [];
      cart.restaurantId = restaurantId;
    }

    const index = cart.products.findIndex(p => p.productId.toString() === productId);

    if (quantity === 0) {
      // Remove product if quantity is zero
      if (index > -1) {
        cart.products.splice(index, 1);
      } else {
        return res.status(400).json({
          message: "Product not found in cart to remove",
          messageType: "failure"
        });
      }
    } else {
      const newQty = quantity > 0 ? quantity : 1;
      const price = productData.price;

      if (index > -1) {
        cart.products[index].quantity = newQty;
        cart.products[index].total = newQty * price;
      } else {
        cart.products.push({
          productId: productId,
          name: productData.name,
          price,
          quantity: newQty,
          total: newQty * price
        });
      }
    }

    // If no products left after update
    if (cart.products.length === 0) {
      await cart.deleteOne();
      return res.status(200).json({
        message: "Cart is now empty",
        messageType: "success",
        cart: null
      });
    }

    cart.totalPrice = cart.products.reduce((sum, p) => sum + p.total, 0);
    await cart.save();

    return res.status(200).json({
      message: "Cart updated successfully",
      messageType: "success",
      cart
    });

  } catch (error) {
    console.error("Error inside addToCartOneByOne service:", error);
    res.status(error.status || 500).json({
      message: error.message || "Something went wrong",
      messageType: "failure"
    });
  }
};

exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id;

let cart = await Cart.findOne({ user: userId }).populate('restaurantId', 'name');

    if (!cart) {
      return res.status(200).json({
        message: "Cart is empty",
        messageType: "success",
        data: { items: [] }
      });
    }

    const products = cart.products.map(item => {
      const product = item.productId;

      return {
        productId: product._id,
        name: product.name,
      restaurantName: cart.restaurantId.name,
        description: product.description,
        images: product.images || [],
        foodType: product.foodType,
        price: item.price,
        quantity: item.quantity,
        total: item.total
      };
    });

    const cartData = {
      cartId: cart._id.toString(),
      userId: cart.user.toString(),
      restaurantId: cart.restaurantId,
      products,
      totalPrice: cart.totalPrice,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt
    };

    res.status(200).json({
      message: "Cart fetched successfully",
      messageType: "success",
      data: cartData
    });

  } catch (error) {
    console.error("Get Cart Error:", error);
    res.status(500).json({
      message: "Server error",
      messageType: "failure"
    });
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
