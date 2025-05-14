
const Restaurant = require("../models/restaurantModel")
exports.getNearbyRestaurants = async (req, res) => {
  try {
    const { latitude, longitude, distance = 5000 } = req.query;

    // Validate presence
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Latitude and longitude are required in query parameters.",
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const dist = parseFloat(distance);

    // Validate latitude & longitude
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        message: "Invalid latitude. Must be a number between -90 and 90.",
      });
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        message: "Invalid longitude. Must be a number between -180 and 180.",
      });
    }

    // Validate distance
    if (isNaN(dist) || dist <= 0) {
      return res.status(400).json({
        message: "Distance must be a positive number (in meters).",
      });
    }

    // MongoDB Geo query using $geoNear
    const restaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat], // [lng, lat]
          },
          $maxDistance: dist, // in meters
        },
      },
      active: true, // optionally filter only active restaurants
    });

    res.status(200).json({
      message: "Nearby restaurants fetched successfully.",
      count: restaurants.length,
      restaurants,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while fetching nearby restaurants.",
    });
  }
};
