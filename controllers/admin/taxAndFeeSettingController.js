const mongoose = require('mongoose')
const DeliveryFeeSetting = require("../../models/deliveryFeeSettingSchema");
const City = require("../../models/cityModel");
const Restaurant = require("../../models/restaurantModel");


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





exports.createCityDeliveryFeeSetting = async (req, res) => {
  try {
    const {
      city,
      restaurant,
      serviceCategory,
      feeType,
      baseFee,
      baseDistanceKm,
      perKmFeeBeyondBase,
      enableSurge,
      surgeFee
    } = req.body;
  

    console.log(req.body)
    // Validate required fields
    if (!city || !feeType || baseFee === undefined) {
      return res.status(400).json({
        message: "city, feeType, and baseFee are required.",
        messageType: "failure"
      });
    }

    if (!["Fixed", "Per KM"].includes(feeType)) {
      return res.status(400).json({
        message: "Invalid feeType value. Should be 'Fixed' or 'Per KM'.",
        messageType: "failure"
      });
    }

    // Optional: check if a fee already exists for this city/restaurant/service combo
    const existing = await DeliveryFeeSetting.findOne({
      city,
      restaurant: restaurant || null,
      serviceCategory: serviceCategory || null
    });

    if (existing) {
      return res.status(409).json({
        message: "Delivery fee setting already exists for this city/service/restaurant.",
        messageType: "failure"
      });
    }

    // Create new setting
    const newSetting = new DeliveryFeeSetting({
      city,
      restaurant,
      serviceCategory,
      feeType,
      baseFee,
      baseDistanceKm,
      perKmFeeBeyondBase,
      enableSurge,
      surgeFee
    });

    await newSetting.save();

    return res.status(201).json({
      message: "City-based delivery fee setting created successfully.",
      messageType: "success",
      data: newSetting
    });

  } catch (error) {
    console.error("Error creating city delivery fee setting:", error);
    return res.status(500).json({
      message: "Internal server error",
      messageType: "failure",
      error
    });
  }
};







exports.createOrUpdateCityDeliveryFeeSetting = async (req, res) => {
  try {
    const {
      city,
      restaurant,
      serviceCategory,
      feeType,
      baseFee,
      baseDistanceKm,
      perKmFeeBeyondBase,
      enableSurge,
      surgeFee
    } = req.body;

    // Validate required fields
    if (!city || !feeType || baseFee === undefined) {
      return res.status(400).json({
        message: "city, feeType, and baseFee are required.",
        messageType: "failure"
      });
    }

    if (!["Fixed", "Per KM"].includes(feeType)) {
      return res.status(400).json({
        message: "Invalid feeType value. Should be 'Fixed' or 'Per KM'.",
        messageType: "failure"
      });
    }

    // Find existing
    const query = {
      city,
      restaurant: restaurant || null,
      serviceCategory: serviceCategory || null
    };

    const update = {
      feeType,
      baseFee,
      baseDistanceKm,
      perKmFeeBeyondBase,
      enableSurge,
      surgeFee
    };

    const options = { new: true, upsert: true, setDefaultsOnInsert: true };

    const setting = await DeliveryFeeSetting.findOneAndUpdate(query, update, options);

    res.status(200).json({
      success: true,
      messageType: "success",
      message: "Delivery fee setting created or updated successfully.",
      data: setting
    });

  } catch (error) {
    console.error("Error creating/updating delivery fee setting:", error);
    res.status(500).json({
      success: false,
      messageType: "failure",
      message: "Internal server error",
      error
    });
  }
};







exports.getCityDeliveryFeeSettings = async (req, res) => {
  try {
    const {
      city,
      restaurant,
      serviceCategory,
      search,
      fields,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    // Safely convert to ObjectId if valid
    if (city && mongoose.Types.ObjectId.isValid(city)) {
      query.city = new mongoose.Types.ObjectId(city);
    }
    if (restaurant && mongoose.Types.ObjectId.isValid(restaurant)) {
      query.restaurant = new mongoose.Types.ObjectId(restaurant);
    }
    if (serviceCategory) query.serviceCategory = serviceCategory;

    // Base aggregation pipeline
    const pipeline = [
      { $match: query },

      // Lookup city details
      {
        $lookup: {
          from: "cities",
          localField: "city",
          foreignField: "_id",
          as: "city",
        },
      },
      { $unwind: "$city" },

      // Lookup restaurant details
      {
        $lookup: {
          from: "restaurants",
          localField: "restaurant",
          foreignField: "_id",
          as: "restaurant",
        },
      },
      {
        $unwind: {
          path: "$restaurant",
          preserveNullAndEmptyArrays: true, // keep null if no restaurant
        },
      },
    ];

    // Optional search by city or restaurant name
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "city.name": { $regex: search, $options: "i" } },
            { "restaurant.name": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Total count before pagination
    const totalCountAgg = await DeliveryFeeSetting.aggregate([
      ...pipeline,
      { $count: "count" },
    ]);
    const total = totalCountAgg[0]?.count || 0;

    // Pagination + sorting
    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    // Optional fields projection
    if (fields) {
      const projection = {};
      fields.split(",").forEach((f) => (projection[f.trim()] = 1));
      pipeline.push({ $project: projection });
    }

    // Final fetch
    const feeSettings = await DeliveryFeeSetting.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      messageType: "success",
      message: "Delivery fee settings fetched successfully.",
      data: feeSettings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching delivery fee settings:", err);
    res.status(500).json({
      success: false,
      messageType: "failure",
      message: "Internal server error.",
    });
  }
};




exports.getSingleCityDeliveryFeeSetting = async (req, res) => {
  try {
    const { city, restaurant, serviceCategory } = req.query;

    if (!city) {
      return res.status(400).json({
        messageType: "failure",
        message: "City ID is required."
      });
    }

    const query = { city };

    if (restaurant) query.restaurant = restaurant;
    else query.restaurant = { $exists: false };  // optional logic if you only want settings without restaurant if none passed

    if (serviceCategory) query.serviceCategory = serviceCategory;
    else query.serviceCategory = { $exists: false };

    const setting = await DeliveryFeeSetting.find(query)
      .populate("city", "name")
      .populate("restaurant", "name")
      .sort({ createdAt: -1 })
      .limit(1);

    if (!setting.length) {
      return res.status(404).json({
        messageType: "failure",
        message: "No delivery fee setting found for this city."
      });
    }

    res.status(200).json({
      success: true,
      messageType: "success",
      message: "Delivery fee setting fetched successfully.",
      data: setting[0]
    });

  } catch (err) {
    console.error("Error fetching delivery fee setting:", err);
    res.status(500).json({
      success: false,
      messageType: "failure",
      message: "Internal server error."
    });
  }
};

