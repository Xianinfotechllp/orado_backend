const Shop = require("../models/shopModel")
const Product = require("../models/productModel")

// Simple regex for email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple regex for phone validation (allows digits, spaces, +, -, parentheses)
const phoneRegex = /^[\d\s()+-]{7,20}$/;

exports.createShop = async (req, res) => {
  try {
    const {
      name,
      address,
      phone,
      email,
      location,
      serviceAreas,
      minOrderAmount,
      paymentMethods,
      description,
      images,
      active,
    } = req.body;

    // Check required fields
    if (!name || !phone || !email) {
      return res.status(400).json({ success: false, message: "Name, phone, and email are required." });
    }

    // Validate email
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    // Validate phone
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number format." });
    }

    // Validate address - check essential fields inside address object
    if (!address || typeof address !== "object") {
      return res.status(400).json({ success: false, message: "Address is required and must be an object." });
    }
    const { street, city, state, zip } = address;
    if (!street || !city || !state || !zip) {
      return res.status(400).json({ success: false, message: "Address must include street, city, state, and zip." });
    }

    // Now create the shop
    const merchantId = req.user._id;  // assuming auth middleware sets this

    const newShop = new Shop({
      merchantId,
      name,
      address,
      phone,
      email,
      location,
      serviceAreas,
      active: active !== undefined ? active : true,
      minOrderAmount,
      paymentMethods,
      description,
      images,
    });

    await newShop.save();

    return res.status(201).json({ success: true, data: newShop });
  } catch (error) {
    console.error("Error creating shop:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.editShop = async (req, res) => {
  try {
    const shopId = req.params.id;
    const updates = req.body;

    // Fetch the shop to update
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    // Optional: check ownership, assuming req.user._id from auth middleware
    if (shop.merchantId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to edit this shop" });
    }

    // Validate email if provided
    if (updates.email && !emailRegex.test(updates.email)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    // Validate phone if provided
    if (updates.phone && !phoneRegex.test(updates.phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number format." });
    }

    // Validate address if provided
    if (updates.address) {
      const { street, city, state, zip } = updates.address;
      if (!street || !city || !state || !zip) {
        return res.status(400).json({ success: false, message: "Address must include street, city, state, and zip." });
      }
    }

    // Update allowed fields only (to avoid unwanted updates)
    const allowedUpdates = [
      "name",
      "address",
      "phone",
      "email",
      "location",
      "serviceAreas",
      "minOrderAmount",
      "paymentMethods",
      "description",
      "images",
      "active"
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        shop[field] = updates[field];
      }
    });

    await shop.save();

    return res.status(200).json({ success: true, data: shop });
  } catch (error) {
    console.error("Error editing shop:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};



exports.getNearbyShops = async (req, res) => {
  try {
    const { latitude, longitude, maxDistance } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required.",
      });
    }

    const distance = parseInt(maxDistance) || 5000; // default to 5km

    const nearbyShops = await Shop.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: distance, // in meters
        },
      },
      active: true,
    });

    return res.status(200).json({
      success: true,
      data: nearbyShops,
    });
  } catch (error) {
    console.error("Error fetching nearby shops:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};




exports.addCategoryToShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { name, description, images } = req.body;

    // Validate inputs
    if (!name) {
      return res.status(400).json({ success: false, message: "Category name is required." });
    }

    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found." });
    }

    // Create category
    const newCategory = new Category({
      name,
      shopId, // assuming your Category schema has a `shopId` field now
      description,
      images,
      active: true
    });

    await newCategory.save();

    // Optionally add category ID to shop's categories array
    shop.categories.push(newCategory._id);
    await shop.save();

    return res.status(201).json({
      success: true,
      message: "Category added successfully.",
      data: newCategory
    });

  } catch (error) {
    console.error("Error adding category:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};





exports.addProductToShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const {
      name,
      description,
      price,
      categoryId,
      images,
      stock,
      unit,
      attributes,
      rating,
      reorderLevel,
      revenueShare,
    } = req.body;

    // Basic validation
    if (!name || !price || !categoryId) {
      return res.status(400).json({
        success: false,
        message: "Name, price, and categoryId are required.",
      });
    }

    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found." });
    }

    // Check if category exists and belongs to this shop
    const category = await Category.findOne({ _id: categoryId, shopId });
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found for this shop." });
    }

    // Create product
    const newProduct = new Product({
      name,
      description,
      price,
      categoryId,
      shopId, // assuming Product schema has shopId now
      images,
      stock,
      unit,
      attributes,
      rating,
      reorderLevel,
      revenueShare,
      active: true
    });

    await newProduct.save();

    // Optionally, push to shop.products array
    shop.products.push(newProduct._id);
    await shop.save();

    return res.status(201).json({
      success: true,
      message: "Product added successfully.",
      data: newProduct
    });

  } catch (error) {
    console.error("Error adding product:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.getProductsForShop = async (req, res) => {
  try {
    const { shopId } = req.params;

    const products = await Product.find({ shopId, active: true }).populate("categoryId");

    return res.status(200).json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


