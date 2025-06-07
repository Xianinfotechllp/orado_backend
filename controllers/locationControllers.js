


const Restaurant = require("../models/restaurantModel");
const mongoose = require('mongoose');
const Category = require('../models/categoryModel');
const Product = require("../models/productModel")
// Haversine formula to calculate distance between two coordinates in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}




exports.getRestaurantsInServiceArea = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    // Validate presence
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Latitude and longitude are required in query parameters.",
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Validate lat & lng ranges
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ message: "Invalid latitude." });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ message: "Invalid longitude." });
    }

    // Geo query to find restaurants where the point intersects with any of the polygons in serviceAreas array
    const restaurants = await Restaurant.find({
      serviceAreas: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
        },
      },
      active: true,
    }).select("name address phone email serviceAreas location rating images foodType" );

    res.status(200).json({
      message: "Restaurants in your service area fetched successfully.",
      count: restaurants.length,
      data:restaurants,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error while fetching restaurants in service area.",
      error: error.message,
    });
  }
};


exports.getNearbyCategories = async (req, res) => {
  try {
    const { latitude, longitude, distance = 5000 } = req.query;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Latitude and longitude are required in query parameters.",
        messageType: "failure",
        statusCode: 400,
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const dist = parseFloat(distance);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        message: "Invalid latitude. Must be a number between -90 and 90.",
        messageType: "failure",
        statusCode: 400,
      });
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        message: "Invalid longitude. Must be a number between -180 and 180.",
        messageType: "failure",
        statusCode: 400,
      });
    }

    if (isNaN(dist) || dist <= 0) {
      return res.status(400).json({
        message: "Distance must be a positive number (in meters).",
        messageType: "failure",
        statusCode: 400,
      });
    }

    // 1. Find nearby restaurants
    const nearbyRestaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: dist,
        },
      },
      active: true,
    }).select("_id");

    const restaurantIds = nearbyRestaurants.map(r => r._id);

    if (restaurantIds.length === 0) {
      return res.status(200).json({
        message: "No nearby restaurants found.",
        messageType: "success",
        statusCode: 200,
        count: 0,
        data: [],
      });
    }

    // 2. Find categories with those restaurantIds and active
    const categories = await Category.find({
      restaurantId: { $in: restaurantIds },
      active: true,
    });

    // Optional: Remove duplicate categories by name (if needed)
    const uniqueCategoriesMap = new Map();
    categories.forEach(cat => {
      if (!uniqueCategoriesMap.has(cat.name)) {
        uniqueCategoriesMap.set(cat.name, cat);
      }
    });

    const uniqueCategories = Array.from(uniqueCategoriesMap.values());

    // 3. Return categories
    return res.status(200).json({
      message: "Nearby categories fetched successfully.",
      messageType: "success",
      statusCode: 200,
      count: uniqueCategories.length,
      data: uniqueCategories,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error while fetching nearby categories.",
      messageType: "error",
      statusCode: 500,
    });
  }
};

exports.getRestaurantsByLocationAndCategory = async (req, res) => {
  try {
    const { latitude, longitude, distance = 5000, categoryId } = req.query;

    // Validate required params
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Latitude and longitude are required.",
        messageType: "error",
        statusCode: 400,
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const dist = parseFloat(distance);

    // Validate latitude and longitude
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        message: "Invalid latitude.",
        messageType: "error",
        statusCode: 400,
      });
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        message: "Invalid longitude.",
        messageType: "error",
        statusCode: 400,
      });
    }

    if (isNaN(dist) || dist <= 0) {
      return res.status(400).json({
        message: "Distance must be a positive number.",
        messageType: "error",
        statusCode: 400,
      });
    }

    // Validate categoryId if provided
    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({
          message: "Invalid categoryId format.",
          messageType: "error",
          statusCode: 400,
        });
      }

      // Check if category exists and is active
      const categoryExists = await Category.findOne({ _id: categoryId, active: true });
      if (!categoryExists) {
        return res.status(404).json({
          message: "Category not found or inactive.",
          messageType: "error",
          statusCode: 404,
        });
      }
    }

    // Build query for restaurants
    const query = {
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: dist,
        },
      },
      active: true,
    };

    // If categoryId given, filter by categoryId field in restaurants
    if (categoryId) {
      query.categoryId = categoryId;
    }

    const restaurants = await Restaurant.find(query)
      .select("name address openingHours minOrderAmount foodType phone rating images location");

    return res.status(200).json({
      message: "Restaurants fetched successfully.",
      messageType: "success",
      statusCode: 200,
      count: restaurants.length,
      data: restaurants,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error while fetching restaurants.",
      messageType: "error",
      statusCode: 500,
    });
  }
};


exports.getRecommendedRestaurants = async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 5000, minOrderAmount = 0 } = req.query;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        messageType: "failure",
        message: "Latitude and longitude are required.",
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const dist = parseInt(maxDistance, 10);
    const minOrder = parseInt(minOrderAmount, 10);

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        messageType: "failure",
        message: "Invalid latitude or longitude values.",
      });
    }

    if (isNaN(dist) || dist <= 0) {
      return res.status(400).json({
        messageType: "failure",
        message: "maxDistance must be a positive number (meters).",
      });
    }

    // Fetch restaurants sorted by rating within maxDistance
    const restaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: dist,
        },
      },
      minOrderAmount: { $gte: minOrder },
      active: true
    })
      .sort({ rating: -1 })
      .limit(20)
      .select("name address minOrderAmount foodType phone rating images location"); // 👈 excluded here

    if (restaurants.length === 0) {
      return res.status(200).json({
        messageType: "success",
        message: "No recommended restaurants found in your area.",
        count: 0,
        data: [],
      });
    }

    return res.status(200).json({
      messageType: "success",
      message: "Recommended restaurants fetched successfully.",
      count: restaurants.length,
      data: restaurants,
    });

  } catch (error) {
    console.error('Error fetching recommended restaurants:', error);
    return res.status(500).json({
      messageType: "failure",
      message: "Server error while fetching recommended restaurants.",
    });
  }
};



exports.getNearbyProducts = async (req, res) => {
  try {
    const { latitude, longitude, distance = 5000 } = req.query;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Latitude and longitude are required in query parameters.",
        messageType: "failure",
        statusCode: 400,
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const dist = parseFloat(distance);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        message: "Invalid latitude. Must be a number between -90 and 90.",
        messageType: "failure",
        statusCode: 400,
      });
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        message: "Invalid longitude. Must be a number between -180 and 180.",
        messageType: "failure",
        statusCode: 400,
      });
    }

    if (isNaN(dist) || dist <= 0) {
      return res.status(400).json({
        message: "Distance must be a positive number (in meters).",
        messageType: "failure",
        statusCode: 400,
      });
    }

    // 1️⃣ Find nearby active restaurants
    const nearbyRestaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: dist,
        },
      },
      active: true,
    }).select("_id");

    const restaurantIds = nearbyRestaurants.map(r => r._id);

    if (restaurantIds.length === 0) {
      return res.status(200).json({
        message: "No nearby restaurants found.",
        messageType: "success",
        statusCode: 200,
        count: 0,
        data: [],
      });
    }

    // 2️⃣ Fetch nearby products with specific fields
    const products = await Product.find({
      restaurantId: { $in: restaurantIds },
      active: true,
    }).select("name description images price");

    return res.status(200).json({
      message: "Nearby products fetched successfully.",
      messageType: "success",
      statusCode: 200,
      count: products.length,
      data: products,
    });

  } catch (error) {
    console.error("Error fetching nearby products:", error);
    return res.status(500).json({
      message: "Server error while fetching nearby products.",
      messageType: "error",
      statusCode: 500,
    });
  }
};






