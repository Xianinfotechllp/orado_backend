
const mongoose = require('mongoose')
const PromoCode = require("../models/promoCodeModels");

exports.createPromoCode = async (req, res) => {
  try {
    const {
      code,
      description,  // ✅ added here
      discountType,
      discountValue,
      minOrderValue,
      validFrom,
      validTill,
      isActive,
      isMerchantSpecific,
      applicableMerchants,
      isCustomerSpecific,
      applicableCustomers,
      maxUsagePerCustomer
    } = req.body;

    // Basic validation
    if (!code || !discountType || !discountValue || !validFrom || !validTill) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields."
      });
    }

    // Ensure valid date range
    if (new Date(validFrom) >= new Date(validTill)) {
      return res.status(400).json({
        success: false,
        message: "validFrom should be before validTill."
      });
    }

    // Check for existing code
    const existing = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Promo code already exists."
      });
    }

    // Create new promo code
    const newPromo = new PromoCode({
      code: code.toUpperCase().trim(),
      description: description?.trim() || "",  // ✅ safely set optional description
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      validFrom,
      validTill,
      isActive: isActive !== undefined ? isActive : true,
      isMerchantSpecific: isMerchantSpecific || false,
      applicableMerchants: isMerchantSpecific ? applicableMerchants : [],
      isCustomerSpecific: isCustomerSpecific || false,
      applicableCustomers: isCustomerSpecific ? applicableCustomers : [],
      maxUsagePerCustomer: maxUsagePerCustomer || 0,
      totalUsageCount: 0,
      customersUsed: []
    });

    await newPromo.save();

    return res.status(201).json({
      success: true,
      message: "Promo code created successfully.",
      data: newPromo
    });

  } catch (error) {
    console.error("Error creating promo code:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message
    });
  }
};




exports.getAllPromoCodes = async (req, res) => {
  try {
    const {
      isActive,
      isMerchantSpecific,
      isCustomerSpecific,
      code,
      validFrom,
      validTill
    } = req.query;

    const filter = {};

    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (isMerchantSpecific !== undefined) filter.isMerchantSpecific = isMerchantSpecific === "true";
    if (isCustomerSpecific !== undefined) filter.isCustomerSpecific = isCustomerSpecific === "true";
    if (code) filter.code = new RegExp(code, "i"); // case-insensitive search

    if (validFrom && validTill) {
      filter.validFrom = { $gte: new Date(validFrom) };
      filter.validTill = { $lte: new Date(validTill) };
    }

    const promos = await PromoCode.find(filter)
      .populate("applicableMerchants")
      .populate("applicableCustomers")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: promos
    });

  } catch (error) {
    console.error("Error fetching promo codes:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message
    });
  }
};

// exports.updatePromo = async (req, res) => {
//   try {
//     const { promoId } = req.params;
//     const updateData = req.body;

//     const allowedFields = [
//       "language",
//       "promotionType",
//       "promotionName",
//       "discountValue",
//       "description",
//       "from",
//       "till",
//       "maximumDiscountValue",
//       "maximumNoOfAllowedUsers",
//       "minimumOrderAmount",
//       "applicationMode",
//       "isReusableBySameUser",
//       "allowLoyaltyRedeem",
//       "allowLoyaltyEarn",
//       "promoAppliedOn",
//       "applicableOrderNumbers",
//       "assignedRestaurants",
//       "active"  // if you want to toggle promo status
//     ];

//     // Filter updateData to only allowed fields
//     const filteredUpdateData = {};
//     for (const key in updateData) {
//       if (allowedFields.includes(key)) {
//         filteredUpdateData[key] = updateData[key];
//       }
//     }

//     if (Object.keys(filteredUpdateData).length === 0) {
//       return res.status(400).json({ success: false, message: "No valid fields provided for update." });
//     }

//     const updatedPromo = await PromoCode.findByIdAndUpdate(
//       promoId,
//       { $set: filteredUpdateData },
//       { new: true }
//     );

//     if (!updatedPromo) {
//       return res.status(404).json({ success: false, message: "Promo code not found" });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Promo code updated successfully",
//       data: updatedPromo,
//     });

//   } catch (error) {
//     console.error("Error updating promo code:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to update promo code",
//     });
//   }
// };


// exports.deletePromo = async (req, res) => {
//   try {
//     const { promoId } = req.params;

//     const deletedPromo = await PromoCode.findByIdAndDelete(promoId);

//     if (!deletedPromo) {
//       return res.status(404).json({ success: false, message: "Promo code not found" });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Promo code deleted successfully",
//     });
//   } catch (error) {
//     console.error("Error deleting promo code:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete promo code",
//     });
//   }
// };


// exports.togglePromoStatus = async (req, res) => {
//   try {
//     const { promoId } = req.params;

//     const promo = await PromoCode.findById(promoId);

//     if (!promo) {
//       return res.status(404).json({ success: false, message: "Promo code not found" });
//     }

//     promo.isActive = !promo.isActive;
//     await promo.save();

//     return res.status(200).json({
//       success: true,
//       message: `Promo code has been ${promo.isActive ? "activated" : "deactivated"}`,
//       data: promo,
//     });
//   } catch (error) {
//     console.error("Error toggling promo status:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to toggle promo status",
//     });
//   }
// };
exports.deletePromoCode = async (req, res) => {
  try {
    const { promoId } = req.params;

    const deletedPromo = await PromoCode.findByIdAndDelete(promoId);

    if (!deletedPromo) {
      return res.status(404).json({ success: false, message: "Promo code not found" });
    }

    res.status(200).json({ success: true, message: "Promo code deleted successfully" });
  } catch (error) {
    console.error("Error deleting promo code:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



exports.togglePromoCodeStatus = async (req, res) => {
  try {
    const { promoId  } = req.params;

    const promo = await PromoCode.findById(promoId);
    if (!promo) {
      return res.status(404).json({ success: false, message: "Promo code not found" });
    }

    promo.isActive = !promo.isActive;
    await promo.save();

    res.status(200).json({
      success: true,
      message: `Promo code ${promo.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: promo.isActive
    });

  } catch (error) {
    console.error("Error toggling promo code status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



exports.updatePromoCode = async (req, res) => {
  try {
    const { promoId } = req.params;

    // Validate promoId
    if (!mongoose.Types.ObjectId.isValid(promoId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promo code ID."
      });
    }

    // Extract updatable fields from request body
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderValue,
      validFrom,
      validTill,
      isActive,
      isMerchantSpecific,
      applicableMerchants,
      isCustomerSpecific,
      applicableCustomers,
      maxUsagePerCustomer
    } = req.body;

    // Prepare an update object with only present fields
    const updateFields = {};

    if (code) updateFields.code = code.toUpperCase().trim();
    if (description !== undefined) updateFields.description = description;
    if (discountType) updateFields.discountType = discountType;
    if (discountValue !== undefined) updateFields.discountValue = discountValue;
    if (minOrderValue !== undefined) updateFields.minOrderValue = minOrderValue;
    if (validFrom) updateFields.validFrom = validFrom;
    if (validTill) updateFields.validTill = validTill;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (isMerchantSpecific !== undefined) {
      updateFields.isMerchantSpecific = isMerchantSpecific;
      updateFields.applicableMerchants = isMerchantSpecific ? applicableMerchants : [];
    }
    if (isCustomerSpecific !== undefined) {
      updateFields.isCustomerSpecific = isCustomerSpecific;
      updateFields.applicableCustomers = isCustomerSpecific ? applicableCustomers : [];
    }
    if (maxUsagePerCustomer !== undefined) {
      updateFields.maxUsagePerCustomer = maxUsagePerCustomer;
    }

    // Update the promo code
    const updatedPromo = await PromoCode.findByIdAndUpdate(
      promoId,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedPromo) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Promo code updated successfully.",
      data: updatedPromo
    });

  } catch (error) {
    console.error("Error updating promo code:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message
    });
  }
};

