const Preferences = require("../models/preferencesModel");

// 📌 Get current preferences (singleton)
exports.getPreferences = async (req, res) => {
  try {
    const preferences = await Preferences.getPreferences();

    res.status(200).json({
      message: "Preferences fetched successfully.",
      data: preferences,
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({
      message: "Failed to fetch preferences.",
      error: error.message,
    });
  }
};

// 📌 Create or Update preferences
exports.createOrUpdatePreferences = async (req, res) => {
  try {
    const preferences = await Preferences.getPreferences();

    // Merge new values
    Object.assign(preferences, req.body);

    await preferences.save();

    res.status(200).json({
      message: "Preferences updated successfully.",
      data: preferences,
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({
      message: "Failed to update preferences.",
      error: error.message,
    });
  }
};

// 📌 Add a new user tag
exports.addUserTag = async (req, res) => {
  try {
    const { name, isDefault = false } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Tag name is required." });
    }

    const preferences = await Preferences.getPreferences();

    preferences.userTags.push({ name, isDefault });
    await preferences.save();

    res.status(200).json({
      message: "User tag added successfully.",
      data: preferences.userTags,
    });
  } catch (error) {
    console.error("Error adding user tag:", error);
    res.status(500).json({
      message: "Failed to add user tag.",
      error: error.message,
    });
  }
};

// 📌 Remove a user tag by ID
exports.removeUserTag = async (req, res) => {
  try {
    const { tagId } = req.params;

    const preferences = await Preferences.getPreferences();

    const initialCount = preferences.userTags.length;
    preferences.userTags = preferences.userTags.filter(tag => tag._id.toString() !== tagId);

    if (preferences.userTags.length === initialCount) {
      return res.status(404).json({ message: "Tag not found." });
    }

    await preferences.save();

    res.status(200).json({
      message: "User tag removed successfully.",
      data: preferences.userTags,
    });
  } catch (error) {
    console.error("Error removing user tag:", error);
    res.status(500).json({
      message: "Failed to remove user tag.",
      error: error.message,
    });
  }
};

