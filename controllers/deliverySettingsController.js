const DeliverySettings = require("../models/DeliverySettingsModel");

/**
 * @desc    Get delivery settings by restaurantId (or global if null)
 * @route   GET /api/delivery-settings/:restaurantId?
 * @access  Private (Admin)
 */
exports.getDeliverySettings = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const settings = await DeliverySettings.findOne({
      restaurantId: restaurantId || null
    });

    if (!settings) {
      return res.status(404).json({ message: "Delivery settings not found." });
    }

    res.status(200).json(settings);

  } catch (error) {
    console.error("Get Delivery Settings Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc    Create or Update delivery settings by restaurantId
 * @route   POST /api/delivery-settings/:restaurantId?
 * @access  Private (Admin)
 */
exports.createOrUpdateDeliverySettings = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const data = req.body;

    const updatedSettings = await DeliverySettings.findOneAndUpdate(
      { restaurantId: restaurantId || null },
      data,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      message: "Delivery settings updated successfully",
      data: updatedSettings
    });

  } catch (error) {
    console.error("Update Delivery Settings Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
