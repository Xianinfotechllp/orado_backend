const ThemeSettings = require("../models/themeSettingsModel")

const isValidHex = (value) => /^#([0-9A-F]{3}){1,2}$/i.test(value);

exports.createOrUpdateThemeSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const themeData = req.body;

    // Validate required fields
    const requiredFields = [
      "primaryNavbar",
      "menuButton",
      "buttonsTabs",
      "buttonText",
      "menuHover"
    ];

    const missingFields = requiredFields.filter(field => !themeData[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`
      });
    }

    // Validate hex color format
    const invalidColors = requiredFields.filter(
      field => !isValidHex(themeData[field])
    );

    if (invalidColors.length > 0) {
      return res.status(400).json({
        message: `Invalid hex color values for: ${invalidColors.join(", ")}`
      });
    }

    // Check if settings exist
    const existingSettings = await ThemeSettings.findOne({ createdBy: userId });

    if (existingSettings) {
      // Update existing
      const updatedSettings = await ThemeSettings.findOneAndUpdate(
        { createdBy: userId },
        { ...themeData },
        { new: true }
      );

      return res.status(200).json(updatedSettings);
    }

    // Create new settings
    const newSettings = new ThemeSettings({
      ...themeData,
      createdBy: userId
    });

    await newSettings.save();

    res.status(201).json(newSettings);
  } catch (error) {
    console.error("Error saving theme settings:", error);
    res.status(500).json({ message: "Server error." });
  }
};


exports.getThemeSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    // Find theme settings by userId
    const settings = await ThemeSettings.findOne({ createdBy: userId });

    if (!settings) {
      return res.status(404).json({ message: "Theme settings not found for this user." });
    }

    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching theme settings:", error);
    res.status(500).json({ message: "Server error." });
  }
};