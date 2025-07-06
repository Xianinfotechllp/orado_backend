const OrderSettings = require("../models/OrderSettingsModel")

exports.getOrderSettings = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return res.status(400).json({ message: 'Restaurant ID is required.' });
    }

    const settings = await OrderSettings.findOne({ restaurantId });

    if (!settings) {
      return res.status(404).json({ message: 'Order settings not found for this restaurant.' });
    }

    res.status(200).json({ message: 'Order settings fetched successfully.', data: settings });
  } catch (err) {
    console.error('Error fetching order settings:', err);
    res.status(500).json({ message: 'Failed to fetch order settings.', error: err.message });
  }
};


exports.saveOrderSettings = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      acceptRejectOrder,
      editOrder,
      autoPrint,
      orderStatusConfig,
      emailTaxLabel,
      taskTagging,
      ratingsReviews,
      acceptanceTime,
      scheduleAdjustThreshold,
      bufferTime
    } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID is required." });
    }

    const settingsData = {
      restaurantId,
      acceptRejectOrder,
      editOrder,
      autoPrint,
      orderStatusConfig,
      emailTaxLabel,
      taskTagging,
      ratingsReviews,
      acceptanceTime,
      scheduleAdjustThreshold,
      bufferTime
    };

    const settings = await OrderSettings.findOneAndUpdate(
      { restaurantId },
      settingsData,
      { new: true, upsert: true }  // upsert: create if not exists
    );

    res.status(200).json({
      message: "Order settings saved successfully.",
      data: settings
    });

  } catch (error) {
    console.error("Error saving order settings:", error);
    res.status(500).json({
      message: "Failed to save order settings.",
      error: error.message
    });
  }
};




exports.saveGlobalOrderSettings = async (req, res) => {
  try {
    const {
      acceptRejectOrder,
      editOrder,
      autoPrint,
      orderStatusConfig,
      emailTaxLabel,
      taskTagging,
      ratingsReviews,
      acceptanceTime,
      scheduleAdjustThreshold,
      bufferTime
    } = req.body;

    const settingsData = {
      restaurantId: null,  // explicitly null for global
      acceptRejectOrder,
      editOrder,
      autoPrint,
      orderStatusConfig,
      emailTaxLabel,
      taskTagging,
      ratingsReviews,
      acceptanceTime,
      scheduleAdjustThreshold,
      bufferTime
    };

    const settings = await OrderSettings.findOneAndUpdate(
      { restaurantId: null },
      settingsData,
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: "Global order settings saved successfully.",
      data: settings
    });

  } catch (error) {
    console.error("Error saving global order settings:", error);
    res.status(500).json({
      message: "Failed to save global order settings.",
      error: error.message
    });
  }
};


exports.getGlobalOrderSettings = async (req, res) => {
  try {
    const settings = await OrderSettings.findOne({ restaurantId: null });

    if (!settings) {
      return res.status(404).json({ message: 'Global order settings not found.' });
    }

    res.status(200).json({ message: 'Global order settings fetched successfully.', data: settings });
  } catch (err) {
    console.error('Error fetching global order settings:', err);
    res.status(500).json({ message: 'Failed to fetch global order settings.', error: err.message });
  }
};


