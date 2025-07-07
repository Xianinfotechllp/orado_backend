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
      chargeType,
      status,
      isNormalOrderActive,
      normalOrderChargeCalculation,
      isCustomOrderActive,
      customOrderChargeCalculation
    } = req.body;

    // Basic validations
    if (!name || !chargeType) {
      return res.status(400).json({
        success: false,
        message: "City name and charge type are required"
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

    // Create new city
    const newCity = new City({
      name: name.trim(),
      description: description || "",
      geofences: geofences || [],
      chargeType,
      status: status !== undefined ? status : true,
      isNormalOrderActive: !!isNormalOrderActive,
      normalOrderChargeCalculation: !!normalOrderChargeCalculation,
      isCustomOrderActive: !!isCustomOrderActive,
      customOrderChargeCalculation: !!customOrderChargeCalculation
    });

    await newCity.save();

    res.status(201).json({
      success: true,
      message: "City created successfully",
      data: newCity
    });

  } catch (error) {
    console.error("Error creating city:", error);
    res.status(500).json({
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