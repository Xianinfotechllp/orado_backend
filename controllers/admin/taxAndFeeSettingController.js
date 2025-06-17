const mongoose = require('mongoose')

const TaxAndFeeSetting = require('../../models/taxAndFeeSettingModel')
exports.addTax = async (req, res) => {
  try {
    const { name, percentage, applicableFor } = req.body;

    if (!name || percentage == null || !applicableFor) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    let settings = await TaxAndFeeSetting.findOne();
    if (!settings) {
      settings = new TaxAndFeeSetting();
    }

    const duplicate = settings.taxes.find(
      (t) => t.name.toLowerCase() === name.toLowerCase() && t.applicableFor === applicableFor
    );
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'A tax with this name already exists for this category.' });
    }

    const newTax = {
      _id: new mongoose.Types.ObjectId(),
      name,
      percentage,
      applicableFor
    };

    settings.taxes.push(newTax);
    await settings.save();

    return res.status(201).json({ success: true, message: 'Tax added successfully', data: newTax });
  } catch (error) {
    console.error('Error adding tax:', error);
    return res.status(500).json({ success: false, message: 'Server error while adding tax' });
  }
};




exports.getAllTaxes = async (req, res) => {
  try {
    console.log("test")
    const settings = await TaxAndFeeSetting.findOne();

    if (!settings || settings.taxes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No taxes found in system.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Taxes fetched successfully.',
      data: settings.taxes
    });

  } catch (error) {
    console.error('Error fetching taxes:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching taxes. Please try again later.'
    });
  }
};



// DELETE /api/admin/taxes/:id
  exports.deleteTax = async (req, res) => {
    try {
      const { taxId } = req.params;

      if (!taxId) {
        return res.status(400).json({ success: false, message: 'Tax ID is required' });
      }

      // Find the tax settings document
      const settings = await TaxAndFeeSetting.findOne();
      if (!settings) {
        return res.status(404).json({ success: false, message: 'Tax settings not found' });
      }

      // Find tax index
      const taxIndex = settings.taxes.findIndex(tax => tax._id.toString() === taxId);
      if (taxIndex === -1) {
        return res.status(404).json({ success: false, message: 'Tax not found' });
      }

      // Remove tax from array
      settings.taxes.splice(taxIndex, 1);
      await settings.save();

      return res.status(200).json({
        success: true,
        message: 'Tax deleted successfully',
        data: settings.taxes  // optional — return updated list if useful for frontend
      });

    } catch (error) {
      console.error('Error deleting tax:', error);
      return res.status(500).json({ success: false, message: 'Server error while deleting tax' });
    }
  };


exports.editTax = async (req, res) => {
  try {

    
    const { taxId } = req.params;
    const { name, percentage, applicableFor } = req.body;
    console.log(name)

    // Find TaxAndFeeSetting document
    const settings = await TaxAndFeeSetting.findOne();
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Tax settings not found' });
    }

    // Find tax by _id
    const tax = settings.taxes.find(t => t._id.toString() === taxId);
    if (!tax) {
      return res.status(404).json({ success: false, message: 'Tax not found' });
    }

    // Check for duplicate tax with same name and applicableFor (if name or applicableFor is changing)
    if (name && applicableFor) {
      const duplicate = settings.taxes.find(
        (t) =>
          t._id.toString() !== taxId &&
          t.name.toLowerCase() === name.toLowerCase() &&
          t.applicableFor === applicableFor
      );
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'A tax with this name already exists for this category.' });
      }
    }

    // Update only if value is provided
    if (name) tax.name = name;
    if (percentage != null) tax.percentage = percentage;
    if (applicableFor) tax.applicableFor = applicableFor;

    await settings.save();

    return res.status(200).json({ success: true, message: 'Tax updated successfully', data: tax });

  } catch (error) {
    console.error('Error updating tax:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating tax' });
  }
};
exports.toggleTaxStatus = async (req, res) => {
  try {
    const { taxId } = req.params;

    const settings = await TaxAndFeeSetting.findOne();
    if (!settings) {
      return res.status(404).json({ success: false, message: "Settings not found." });
    }

    const tax = settings.taxes.id(taxId);
    if (!tax) {
      return res.status(404).json({ success: false, message: "Tax not found." });
    }

    tax.active = !tax.active;
    await settings.save();

    res.status(200).json({
      success: true,
      message: "Tax status toggled successfully.",
      data: tax
    });

  } catch (error) {
    console.error("Error toggling tax status:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};


exports.updateDeliveryFeeSettings = async (req, res) => {
  try {
    const {
      deliveryFeeType, // 'Fixed' | 'Per KM' | 'Per Order Type'
      baseDeliveryFee,
      baseDistanceKm,
      perKmFeeBeyondBase,
      orderTypeDeliveryFees // object like { "food": 30, "grocery": 40 }
    } = req.body;

    // Validate fee type
    if (!["Fixed", "Per KM", "Per Order Type"].includes(deliveryFeeType)) {
      return res.status(400).json({
        message: "Invalid deliveryFeeType value.",
        messageType: "failure"
      });
    }

    // Fetch or create settings document
    let settings = await TaxAndFeeSetting.findOne();
    if (!settings) {
      settings = new TaxAndFeeSetting();
    }

    // Update based on fee type
    settings.deliveryFeeType = deliveryFeeType;

    if (deliveryFeeType === "Fixed") {
      if (baseDeliveryFee === undefined) {
        return res.status(400).json({
          message: "baseDeliveryFee is required for Fixed delivery fee type.",
          messageType: "failure"
        });
      }
      settings.baseDeliveryFee = baseDeliveryFee;
    }

    if (deliveryFeeType === "Per KM") {
      if (
        baseDeliveryFee === undefined ||
        baseDistanceKm === undefined ||
        perKmFeeBeyondBase === undefined
      ) {
        return res.status(400).json({
          message:
            "baseDeliveryFee, baseDistanceKm, and perKmFeeBeyondBase are required for Per KM delivery fee type.",
          messageType: "failure"
        });
      }
      settings.baseDeliveryFee = baseDeliveryFee;
      settings.baseDistanceKm = baseDistanceKm;
      settings.perKmFeeBeyondBase = perKmFeeBeyondBase;
    }

    if (deliveryFeeType === "Per Order Type") {
      if (!orderTypeDeliveryFees || typeof orderTypeDeliveryFees !== "object") {
        return res.status(400).json({
          message: "orderTypeDeliveryFees object is required for Per Order Type delivery fee type.",
          messageType: "failure"
        });
      }
      settings.orderTypeDeliveryFees = orderTypeDeliveryFees;
    }

    await settings.save();

    return res.status(200).json({
      message: "Delivery fee settings updated successfully.",
      messageType: "success",
      data: settings
    });

  } catch (error) {
    console.error("Error updating delivery fee settings:", error);
    return res.status(500).json({
      message: "Internal server error",
      messageType: "failure",
      error
    });
  }
};


exports.getDeliveryFeeSettings = async (req, res) => {
  try {
    const settings = await TaxAndFeeSetting.findOne();

    if (!settings) {
      return res.status(404).json({
        message: "Delivery fee settings not found.",
        messageType: "failure",
      });
    }

    return res.status(200).json({
      message: "Delivery fee settings fetched successfully.",
      messageType: "success",
      data: {
        deliveryFeeType: settings.deliveryFeeType,
        baseDeliveryFee: settings.baseDeliveryFee,
        baseDistanceKm: settings.baseDistanceKm,
        perKmFeeBeyondBase: settings.perKmFeeBeyondBase,
        orderTypeDeliveryFees: settings.orderTypeDeliveryFees,
      },
    });
  } catch (error) {
    console.error("Error fetching delivery fee settings:", error);
    return res.status(500).json({
      message: "Internal server error",
      messageType: "failure",
      error,
    });
  }
};

