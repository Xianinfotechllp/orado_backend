const GlobalOrderSettings = require("../models/globalOrderSettingsModel");

/**
 * @desc    Create or Update Global Order Settings
 * @route   POST /api/global-order-settings
 * @access  Admin
 */
exports.createOrUpdateGlobalSettings = async (req, res) => {
  try {
    // Only one document exists — so upsert without filter
    const updatedSettings = await GlobalOrderSettings.findOneAndUpdate(
      {},
      { $set: req.body },
      { new: true, upsert: true }
    );

    return res.status(200).json({ success: true, data: updatedSettings });
  } catch (error) {
    console.error("Error updating global order settings:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * @desc    Get Global Order Settings
 * @route   GET /api/global-order-settings
 * @access  Public/Admin
 */
exports.getGlobalSettings = async (req, res) => {
  try {
    const settings = await GlobalOrderSettings.findOne();

    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found" });
    }

    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("Error fetching global order settings:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
