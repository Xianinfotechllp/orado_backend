const CommissionSettings = require("../models/commissions/CommissionSettings");


exports.saveCommissionSettings = async (req, res) => {
  try {
    // Destructure expected fields from request body
    const {
      defaultCommissionValue,
      commissionType,
      payoutScheduleDays,
      includeDeliveryCharges,
      additionalChargeCommissionTo,
      marketplaceTaxOwner,
      merchantTaxOwner,
      productTaxOwner,
      promoLoyaltyDeductFrom,
      tierCommissionRules
    } = req.body;

    // Validate required fields
    if (typeof defaultCommissionValue !== 'number') {
      return res.status(400).json({ message: "defaultCommissionValue is required and must be a number" });
    }

    if (!["percentage", "fixed"].includes(commissionType)) {
      return res.status(400).json({ message: "commissionType must be 'percentage' or 'fixed'" });
    }

    if (typeof payoutScheduleDays !== 'number') {
      return res.status(400).json({ message: "payoutScheduleDays is required and must be a number" });
    }

    if (typeof includeDeliveryCharges !== 'boolean') {
      return res.status(400).json({ message: "includeDeliveryCharges is required and must be a boolean" });
    }

    if (!["admin", "merchant"].includes(additionalChargeCommissionTo)) {
      return res.status(400).json({ message: "additionalChargeCommissionTo must be 'admin' or 'merchant'" });
    }

    // Optional: Validate tierCommissionRules if provided
    if (tierCommissionRules && !Array.isArray(tierCommissionRules)) {
      return res.status(400).json({ message: "tierCommissionRules must be an array if provided" });
    }

    // Now save or update commission settings
    const settings = await CommissionSettings.findOneAndUpdate(
      {},
      {
        $set: {
          defaultCommissionValue,
          commissionType,
          payoutScheduleDays,
          includeDeliveryCharges,
          additionalChargeCommissionTo,
          marketplaceTaxOwner,
          merchantTaxOwner,
          productTaxOwner,
          promoLoyaltyDeductFrom,
          tierCommissionRules
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({
      message: "Commission settings saved successfully",
      settings
    });

  } catch (error) {
    console.error("Error saving commission settings", error);
    res.status(500).json({ message: "Failed to save commission settings" });
  }
};


// Get Commission Settings
exports.getCommissionSettings = async (req, res) => {
  try {
    const settings = await CommissionSettings.findOne({});
    if (!settings) {
      return res.status(404).json({ message: "No commission settings found" });
    }

    return res.status(200).json({
      message: "Commission settings fetched successfully",
      settings
    });

  } catch (error) {
    console.error("Error fetching commission settings", error);
    res.status(500).json({ message: "Failed to fetch commission settings" });
  }
};