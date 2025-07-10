const mongoose = require("mongoose");

const ThemeSettingsSchema = new mongoose.Schema(
  {
    primaryNavbar: {
      type: String,
      default: "#000000",
    },
    menuButton: {
      type: String,
      default: "#f48fb1",
    },
    buttonsTabs: {
      type: String,
      default: "#fbc02d",
    },
    buttonText: {
      type: String,
      default: "#ffffff",
    },
    menuHover: {
      type: String,
      default: "#272727",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ThemeSettings", ThemeSettingsSchema);
