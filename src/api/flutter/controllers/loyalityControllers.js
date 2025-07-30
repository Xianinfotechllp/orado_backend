const LoyaltySetting = require("../../../../models/LoyaltySettingModel");
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
