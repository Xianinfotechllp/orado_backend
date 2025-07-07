const Geofence = require("../models/GeofenceModel");

// @desc    Create a new Geofence
// @route   POST /api/geofences
// @access  Admin
exports.createGeofence = async (req, res) => {
  try {
    const {
      type,
      regionName,
      regionDescription,
      geometry,
      active,
      lastUpdatedBy
    } = req.body;

    // Basic validation
    if (!type || !regionName || !geometry?.type || !geometry?.coordinates) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Optional validation: check enum values
    const allowedTypes = ["delivery_zone", "surge_area", "restricted_area"];
    const allowedGeometryTypes = ["Polygon", "Circle"];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid geofence type"
      });
    }

    if (!allowedGeometryTypes.includes(geometry.type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid geometry type"
      });
    }

    // If type is Circle, radius is mandatory
    if (geometry.type === "Circle" && !geometry.radius) {
      return res.status(400).json({
        success: false,
        message: "Radius is required for Circle geometry"
      });
    }

    // Create geofence
    const newGeofence = new Geofence({
      type,
      regionName,
      regionDescription,
      geometry,
      active,
      lastUpdatedBy
    });

    await newGeofence.save();

    res.status(201).json({
      success: true,
      message: "Geofence created successfully",
      data: newGeofence
    });
  } catch (error) {
    console.error("Error creating geofence:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};



exports.getGeofences = async (req, res) => {
  try {
    const geofences = await Geofence.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Geofences fetched successfully",
      data: geofences
    });
  } catch (error) {
    console.error("Error fetching geofences:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};





exports.deleteGeofence = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if geofence exists
    const geofence = await Geofence.findById(id);
    if (!geofence) {
      return res.status(404).json({
        success: false,
        message: "Geofence not found"
      });
    }

    // Delete geofence
    await geofence.deleteOne();

    res.status(200).json({
      success: true,
      message: "Geofence deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting geofence:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};