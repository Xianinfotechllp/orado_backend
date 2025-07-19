const Discount = require("../models/discountModel");

// 📌 Create a Restaurant-wise Discount
exports.createRestaurantDiscount = async (req, res) => {
  try {
    const {
      name,                       // 👈 added this
      discountType,
      restaurant,
      discountValue,
      maxDiscountValue,
      description,
      validFrom,
      validTo
    } = req.body;

    // Validate required fields
    if (!name || !discountType || !restaurant || discountValue === undefined) {
      return res.status(400).json({
        success: false,
        message: "Required fields: name, discountType, restaurant, discountValue"
      });
    }

    // Deactivate existing active restaurant discount if any
    await Discount.updateMany(
      { restaurant, applicationLevel: "Restaurant", isActive: true },
      { $set: { isActive: false } }
    );

    // Create new discount
    const newDiscount = await Discount.create({
      name,                       // 👈 include in payload
      discountType,
      applicationLevel: "Restaurant",
      restaurant,
      discountValue,
      maxDiscountValue,
      description,
      validFrom,
      validTo
    });

    return res.status(201).json({
      success: true,
      message: "Previous discount deactivated. New restaurant discount created successfully.",
      data: newDiscount
    });

  } catch (error) {
    console.error("Error creating restaurant discount:", error);
    res.status(500).json({ success: false, message: "Failed to create restaurant discount" });
  }
};


// 📌 Create a Product-wise Discount
exports.createProductDiscount = async (req, res) => {
  try {
    const {
      discountType,
      restaurant,
      product,
      discountValue,
      maxDiscountValue,
      description,
      validFrom,
      validTo
    } = req.body;

    if (!discountType || !restaurant || !product || discountValue === undefined) {
      return res.status(400).json({
        success: false,
        message: "Required fields: discountType, restaurant, product, discountValue"
      });
    }

    const newDiscount = await Discount.create({
      discountType,
      applicationLevel: "Product",
      restaurant,
      product,
      discountValue,
      maxDiscountValue,
      description,
      validFrom,
      validTo
    });

    return res.status(201).json({
      success: true,
      message: "Product discount created successfully",
      data: newDiscount
    });

  } catch (error) {
    console.error("Error creating product discount:", error);
    res.status(500).json({ success: false, message: "Failed to create product discount" });
  }
};

// 📌 Get All Discounts for a Restaurant (both Restaurant + Product discounts)
exports.getRestaurantDiscounts = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "Restaurant ID is required" });
    }

    const discounts = await Discount.find({ restaurant: restaurantId, isActive: true })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: discounts
    });

  } catch (error) {
    console.error("Error fetching restaurant discounts:", error);
    res.status(500).json({ success: false, message: "Failed to fetch discounts" });
  }
};

// 📌 Get Discounts for a Specific Product
exports.getProductDiscounts = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    const discounts = await Discount.find({
      product: productId,
      isActive: true
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: discounts
    });

  } catch (error) {
    console.error("Error fetching product discounts:", error);
    res.status(500).json({ success: false, message: "Failed to fetch product discounts" });
  }
};
