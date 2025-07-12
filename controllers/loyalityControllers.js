const LoyaltySetting = require("../models/LoyaltySettingModel");

// Create or update Loyalty Settings

exports.createOrUpdateLoyaltySettings = async (req, res) => {
  try {
    const {
      pointsPerAmount,
      minOrderAmountForEarning,
      maxEarningPoints,
      expiryDurationDays,
      redemptionCriteria,
      valuePerPoint,
      minOrderAmountForRedemption,
      minPointsForRedemption,
      maxRedemptionPercent
    } = req.body;

    // Basic validation (example)
    if (!pointsPerAmount || !valuePerPoint) {
      return res.status(400).json({
        success: false,
        message: "Points per amount and value per point are required."
      });
    }

    // Upsert single global config
    const settings = await LoyaltySetting.findOneAndUpdate(
      {},
      {
        pointsPerAmount,
        minOrderAmountForEarning,
        maxEarningPoints,
        expiryDurationDays,
        redemptionCriteria,
        valuePerPoint,
        minOrderAmountForRedemption,
        minPointsForRedemption,
        maxRedemptionPercent
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Loyalty settings saved successfully.",
      data: settings
    });

  } catch (error) {
    console.error("Error saving loyalty settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save loyalty settings."
    });
  }
};




exports.getLoyaltySettings = async (req, res) => {
  try {
    const settings = await LoyaltySetting.findOne({}).lean();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "No loyalty settings found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Loyalty settings fetched successfully.",
      data: settings
    });

  } catch (error) {
    console.error("Error fetching loyalty settings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch loyalty settings."
    });
  }
};
