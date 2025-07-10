

const GlobalDeliverySettings = require("../../models/globalDeliverysetting");
exports.createOrUpdateGlobalDeliverySettings = async (req, res) => {
  try {
    const settingsData = req.body;

    // Always updating the first (and only) record, or creating if none exists
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