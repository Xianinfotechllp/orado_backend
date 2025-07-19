const City  = require("../models/cityModel") 
// Add a new city

// exports.addCity = async (req, res) => {
//   try {
//     const {
//       name,
//       cityId, // optional if it's for hierarchy — remove if not needed
//       type,
//       area,
//       center,
//       radius,
//       status,
//     } = req.body;

//     // Basic validation
//     if (!name || !type) {
//       return res.status(400).json({
//         messageType: "failure",
//         message: "Name and type are required fields.",
//       });
//     }

//     // Type-based validation
//     if (type === "Polygon" && (!area || !area.coordinates)) {
//       return res.status(400).json({
//         messageType: "failure",
//         message: "Polygon area coordinates are required for Polygon type.",
//       });
//     }

//     if (type === "Circle" && (!center || !radius)) {
//       return res.status(400).json({
//         messageType: "failure",
//         message: "Center and radius are required for Circle type.",
//       });
//     }

//     // Create city object
//     const newCity = new City({
//       name,
//       cityId, // optional — if you're using hierarchical structure
//       type,
//       status: status || "active",
//     });

//     if (type === "Polygon") {
//       newCity.area = {
//         type: "Polygon",
//         coordinates: area.coordinates,
//       };
//     } else if (type === "Circle") {
//       newCity.center = center;
//       newCity.radius = radius;
//     }

//     const savedCity = await newCity.save();

//     res.status(201).json({
//       messageType: "success",
//       message: "City created successfully.",
//       data: savedCity,
//     });
//   } catch (err) {
//     console.error("Error creating city:", err);
//     res.status(500).json({
//       messageType: "failure",
//       message: "Internal server error.",
//     });
//   }
// };







// Get all cities (optionally filter by status)
// exports.getCities = async (req, res) => {
//   try {
//     const { status } = req.query; // optional query param

//     // Build query object
//     const query = {};
//     if (status) query.status = status;

//     const cities = await City.find(query).sort({ createdAt: -1 });

//     res.status(200).json({
//       messageType: "success",
//       message: "Cities fetched successfully.",
//       data: cities,
//     });
//   } catch (err) {
//     console.error("Error fetching cities:", err);
//     res.status(500).json({
//       messageType: "failure",
//       message: "Internal server error.",
//     });
//   }
// };









// exports.getAllCities = async (req, res) => {
//   try {
//     // Optional query params for status filter
//     const { status } = req.query;
//     const query = {};
//     if (status) query.status = status;

//     const cities = await City.find(query)
//       .select("_id name type status")
//       .sort({ name: 1 })
//       .lean();

//     return res.status(200).json({
//       success: true,
//       message: "Cities fetched successfully",
//       messageType: "success",
//       data: cities
//     });

//   } catch (error) {
//     console.error("Error fetching cities:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       messageType: "failure"
//     });
//   }
// };







exports.createCity = async (req, res) => {
  try {
    const {
      name,
      description,
      geofences,
      isNormalOrderActive,
      normalOrderChargeCalculation,
      normalOrdersChargeType,
      fixedDeliveryChargesNormalOrders,
      dynamicChargesTemplateNormalOrders,
      dynamicChargesTemplateScheduleOrder,
      earningTemplateNormalOrder,
      isCustomOrderActive,
      customOrderChargeCalculation,
      cityChargeType,
      fixedDeliveryChargesCustomOrders,
      status
    } = req.body;

    // Basic validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "City name is required"
      });
    }

    // Check for existing city name
    const existingCity = await City.findOne({ name: name.trim() });
    if (existingCity) {
      return res.status(400).json({
        success: false,
        message: "A city with this name already exists"
      });
    }

    // Clean conversion: if empty string, convert to null
    const cleanObjectId = (value) => {
      if (typeof value === "string" && value.trim() === "") return null;
      return value || null;
    };

    // Create new city
    const newCity = new City({
      name: name.trim(),
      description: description || "",
      geofences: geofences || [],

      // Normal Orders Settings
      isNormalOrderActive: !!isNormalOrderActive,
      normalOrderChargeCalculation: !!normalOrderChargeCalculation,
      normalOrdersChargeType: normalOrdersChargeType || "Fixed",
      fixedDeliveryChargesNormalOrders: fixedDeliveryChargesNormalOrders !== undefined ? fixedDeliveryChargesNormalOrders : 0,
      dynamicChargesTemplateNormalOrders: cleanObjectId(dynamicChargesTemplateNormalOrders),
      dynamicChargesTemplateScheduleOrder: cleanObjectId(dynamicChargesTemplateScheduleOrder),
      earningTemplateNormalOrder: cleanObjectId(earningTemplateNormalOrder),

      // Custom Orders Settings
      isCustomOrderActive: !!isCustomOrderActive,
      customOrderChargeCalculation: !!customOrderChargeCalculation,
      cityChargeType: cityChargeType || "Fixed",
      fixedDeliveryChargesCustomOrders: fixedDeliveryChargesCustomOrders !== undefined ? fixedDeliveryChargesCustomOrders : 0,

      // Status
      status: status !== undefined ? status : true
    });

    await newCity.save();

    return res.status(201).json({
      success: true,
      message: "City created successfully",
      data: newCity
    });

  } catch (error) {
    console.error("Error creating city:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating city"
    });
  }
};








exports.getCities = async (req, res) => {
  try {
    const cities = await City.find()
      .populate("geofences")  // populate geofences if you need their details too
      .sort({ createdAt: -1 }); // most recent first

    res.status(200).json({
      success: true,
      message: "Cities fetched successfully",
      data: cities
    });

  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching cities"
    });
  }

  
};




exports.toggleCityStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the city
    const city = await City.findById(id);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found"
      });
    }

    // Toggle status
    city.status = !city.status;

    // Save updated city
    await city.save();

    res.status(200).json({
      success: true,
      message: `City status updated to ${city.status ? "Active" : "Inactive"}`,
      data: city
    });

  } catch (error) {
    console.error("Error toggling city status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while toggling city status"
    });
  }
};


exports.deleteCity = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if city exists
    const city = await City.findById(id);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found"
      });
    }

    // Delete city
    await city.deleteOne();

    res.status(200).json({
      success: true,
      message: "City deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting city:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting city"
    });
  }
};

exports.updateCity = async (req, res) => {
  try {
    const { id } = req.params;

    // Find city
    const city = await City.findById(id);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found"
      });
    }

    // Update fields if present in req.body
    const {
      name,
      description,
      geofences,
      isNormalOrderActive,
      normalOrderChargeCalculation,
      normalOrdersChargeType,
      fixedDeliveryChargesNormalOrders,
      dynamicChargesTemplateNormalOrders,
      dynamicChargesTemplateScheduleOrder,
      earningTemplateNormalOrder,
      isCustomOrderActive,
      customOrderChargeCalculation,
      cityChargeType,
      fixedDeliveryChargesCustomOrders,
      status
    } = req.body;

    if (name) city.name = name.trim();
    if (description !== undefined) city.description = description;
    if (geofences) city.geofences = geofences;

    // Normal Orders settings
    if (isNormalOrderActive !== undefined) city.isNormalOrderActive = !!isNormalOrderActive;
    if (normalOrderChargeCalculation !== undefined) city.normalOrderChargeCalculation = !!normalOrderChargeCalculation;
    if (normalOrdersChargeType) city.normalOrdersChargeType = normalOrdersChargeType;
    if (fixedDeliveryChargesNormalOrders !== undefined) city.fixedDeliveryChargesNormalOrders = fixedDeliveryChargesNormalOrders;
    if (dynamicChargesTemplateNormalOrders !== undefined) city.dynamicChargesTemplateNormalOrders = dynamicChargesTemplateNormalOrders;
    if (dynamicChargesTemplateScheduleOrder !== undefined) city.dynamicChargesTemplateScheduleOrder = dynamicChargesTemplateScheduleOrder;
    if (earningTemplateNormalOrder !== undefined) city.earningTemplateNormalOrder = earningTemplateNormalOrder;

    // Custom Orders settings
    if (isCustomOrderActive !== undefined) city.isCustomOrderActive = !!isCustomOrderActive;
    if (customOrderChargeCalculation !== undefined) city.customOrderChargeCalculation = !!customOrderChargeCalculation;
    if (cityChargeType) city.cityChargeType = cityChargeType;
    if (fixedDeliveryChargesCustomOrders !== undefined) city.fixedDeliveryChargesCustomOrders = fixedDeliveryChargesCustomOrders;

    // Status
    if (status !== undefined) city.status = !!status;

    await city.save();

    res.status(200).json({
      success: true,
      message: "City updated successfully",
      data: city
    });

  } catch (error) {
    console.error("Error updating city:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating city"
    });
  }
};







exports.updateCityDeliveryFeeSetting = async (req, res) => {
  try {
    const { cityId } = req.params;
    const {
      isCustomFeeEnabled,
      deliveryFeeType,
      baseDeliveryFee,
      baseDistanceKm,
      perKmFeeBeyondBase
    } = req.body;

    // Check if city exists
    const city = await City.findById(cityId);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found."
      });
    }

    // Ensure cityDeliveryFeeSetting exists
    if (!city.cityDeliveryFeeSetting) {
      city.cityDeliveryFeeSetting = {};
    }

    const { cityDeliveryFeeSetting } = city;

    // Update only the provided fields
    if (isCustomFeeEnabled !== undefined) cityDeliveryFeeSetting.isCustomFeeEnabled = isCustomFeeEnabled;
    if (deliveryFeeType !== undefined) cityDeliveryFeeSetting.deliveryFeeType = deliveryFeeType;
    if (baseDeliveryFee !== undefined) cityDeliveryFeeSetting.baseDeliveryFee = baseDeliveryFee;
    if (baseDistanceKm !== undefined) cityDeliveryFeeSetting.baseDistanceKm = baseDistanceKm;
    if (perKmFeeBeyondBase !== undefined) cityDeliveryFeeSetting.perKmFeeBeyondBase = perKmFeeBeyondBase;

    await city.save();

    return res.status(200).json({
      success: true,
      message: "City delivery fee setting updated successfully.",
      data: city
    });
  } catch (error) {
    console.error("Error updating city delivery fee setting:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message
    });
  }
};




exports.getCityDeliveryFeeSetting = async (req, res) => {
  try {
    const { cityId } = req.params;

    // Check if city exists
    const city = await City.findById(cityId);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: "City not found."
      });
    }

    // Return only delivery fee setting
    return res.status(200).json({
      success: true,
      message: "City delivery fee setting fetched successfully.",
      data: city.cityDeliveryFeeSetting
    });
  } catch (error) {
    console.error("Error fetching city delivery fee setting:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
      error: error.message
    });
  }
};
