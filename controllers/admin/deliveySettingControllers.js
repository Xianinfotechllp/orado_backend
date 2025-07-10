const GlobalDeliverySettings = require("../../models/globalDeliverysetting");

/**
 * @desc    Create or Update Global Delivery Settings
 * @route   POST /api/global-delivery-settings
 * @access  Admin
 */
exports.createOrUpdateGlobalDeliverySettings = async (req, res) => {
  try {
    const settingsData = req.body;

    // Upsert: update if exists, otherwise create
    const updatedSettings = await GlobalDeliverySettings.findOneAndUpdate(
      {},
      { $set: settingsData },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Global delivery settings saved successfully.",
      data: updatedSettings
    });

  } catch (error) {
    console.error("Error in createOrUpdateGlobalDeliverySettings:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message
    });
  }
};

/**
 * @desc    Get Global Delivery Settings
 * @route   GET /api/global-delivery-settings
 * @access  Admin / Public
 */
exports.getGlobalDeliverySettings = async (req, res) => {
  try {
    const settings = await GlobalDeliverySettings.findOne();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Global delivery settings not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error("Error in getGlobalDeliverySettings:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message
    });
  }
};
