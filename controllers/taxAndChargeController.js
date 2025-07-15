// controllers/taxAndChargeController.js
const TaxAndCharge = require("../models/taxAndChargeModel");

exports.createTaxAndCharge = async (req, res) => {
  try {
    const {
      name,
      value,
      type,
      applicableOn,
      category,
      level,
      merchant,
      status
    } = req.body;

    if (!name || !value || !type || !applicableOn || !category || !level) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields."
      });
    }

    const newTaxOrCharge = new TaxAndCharge({
      name,
      value,
      type,
      applicableOn,
      category,
      level,
      merchant: merchant || null,
      status: status !== undefined ? status : true
    });

    await newTaxOrCharge.save();

    return res.status(201).json({
      success: true,
      message: "Tax/Charge created successfully.",
      data: newTaxOrCharge
    });

  } catch (error) {
    console.error("Error creating Tax/Charge:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message
    });
  }
};




exports.getAllTaxAndCharges = async (req, res) => {
  try {
    const { level, category, status, merchant, applicableOn } = req.query;

    const filter = {};

    if (level) filter.level = level;
    if (category) filter.category = category;
    if (status !== undefined) filter.status = status === 'true'; // convert string to boolean
    if (merchant) filter.merchant = merchant;
    if (applicableOn) filter.applicableOn = applicableOn;

    const taxesAndCharges = await TaxAndCharge.find(filter)
      .populate("merchant")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: taxesAndCharges
    });
  } catch (error) {
    console.error("Error fetching taxes/charges:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message
    });
  }
};


exports.getTaxAndChargeById = async (req, res) => {
  try {
    const { id } = req.params;

    const taxOrCharge = await TaxAndCharge.findById(id).populate("Restaurant");

    if (!taxOrCharge) {
      return res.status(404).json({
        success: false,
        message: "Tax/Charge not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: taxOrCharge
    });
  } catch (error) {
    console.error("Error fetching tax/charge:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message
    });
  }
};



exports.deleteTaxOrCharge = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate Mongo ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Tax/Charge ID."
      });
    }

    const deleted = await TaxAndCharge.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Tax or Charge not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tax/Charge deleted successfully.",
      data: deleted
    });

  } catch (error) {
    console.error("Error deleting Tax/Charge:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting Tax/Charge.",
      error: error.message
    });
  }
};



exports.toggleTaxOrChargeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Tax/Charge ID."
      });
    }

    // Find the tax/charge
    const taxCharge = await TaxAndCharge.findById(id);
    if (!taxCharge) {
      return res.status(404).json({
        success: false,
        message: "Tax or Charge not found."
      });
    }

    // Toggle status
    taxCharge.status = !taxCharge.status;
    await taxCharge.save();

    return res.status(200).json({
      success: true,
      message: `Tax/Charge status updated to ${taxCharge.status ? 'Active' : 'Inactive'}.`,
      data: taxCharge
    });

  } catch (error) {
    console.error("Error toggling Tax/Charge status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating status.",
      error: error.message
    });
  }
};



exports.updateTaxOrCharge = async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    // Check if record exists
    const existingDoc = await TaxAndCharge.findById(id);
    if (!existingDoc) {
      return res.status(404).json({
        success: false,
        message: "Tax/Charge not found.",
      });
    }

    // Update only provided fields
    Object.keys(updateFields).forEach((key) => {
      existingDoc[key] = updateFields[key];
    });

    await existingDoc.save();

    return res.status(200).json({
      success: true,
      message: "Tax/Charge updated successfully.",
      data: existingDoc,
    });

  } catch (error) {
    console.error("Error updating Tax/Charge:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating Tax/Charge.",
      error: error.message,
    });
  }
};