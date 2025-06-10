


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
    const { categoryName } = req.params;
    const { latitude, longitude, distance = 5000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        message: "Latitude and longitude are required.",
        messageType: "error",
        statusCode: 400
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const dist = parseFloat(distance);

    // Step 1: Find nearby restaurants
    const nearbyRestaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: dist
        }
      },
      active: true
    }).select("_id name address openingHours minOrderAmount foodType phone rating images location");

    if (!nearbyRestaurants.length) {
      return res.status(200).json({
        message: "No nearby restaurants found.",
        messageType: "success",
        statusCode: 200,
        count: 0,
        data: []
      });
    }

    // Step 2: Fuzzy match category name in nearby restaurants
    let finalRestaurants = nearbyRestaurants;

    if (categoryName) {
      const restaurantIds = nearbyRestaurants.map(r => r._id);

      const matchedCategories = await Category.find({
        restaurantId: { $in: restaurantIds },
        name: { $regex: new RegExp(categoryName, "i") }, // fuzzy match
        active: true
      }).select("restaurantId");

      const restaurantIdsFromCategories = [
        ...new Set(matchedCategories.map(cat => cat.restaurantId.toString()))
      ];

      finalRestaurants = nearbyRestaurants.filter(r =>
        restaurantIdsFromCategories.includes(r._id.toString())
      );
    }

    return res.status(200).json({
      message: "Restaurants fetched successfully.",
      messageType: "success",
      statusCode: 200,
      count: finalRestaurants.length,
      data: finalRestaurants
    });

  } catch (error) {
    console.error("Error fetching restaurants by location and category:", error);
    return res.status(500).json({
      message: "Server error while fetching restaurants.",
      messageType: "error",
      statusCode: 500
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





exports.searchRestaurants = async (req, res) => {
  try {
    const { query, location, radius = 5000, limit = 10, page = 1 } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const skip = (page - 1) * limit;

    // 1️⃣ Find restaurants by name/merchantSearchName directly
    const nameResults = await Restaurant.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { merchantSearchName: { $regex: query, $options: "i" } }
      ],
      active: true,
      approvalStatus: "approved"
    }).select("-approvalStatus -kycDocuments -commission");

    // 2️⃣ Get restaurantIds from products matching query
    const productRestaurantIds = await Product.find({
      name: { $regex: query, $options: "i" },
      active: true
    }).distinct("restaurantId");

    // 3️⃣ Get restaurantIds from categories matching query
    const categoryRestaurantIds = await Category.find({
      name: { $regex: query, $options: "i" },
      active: true
    }).distinct("restaurantId");

    // 4️⃣ Combine unique restaurantIds
    const allRestaurantIds = [
      ...new Set([
        ...productRestaurantIds.map(id => id.toString()),
        ...categoryRestaurantIds.map(id => id.toString())
      ])
    ];
   console.log( allRestaurantIds)
    // 5️⃣ Fetch restaurants for those IDs
    const relatedRestaurants = await Restaurant.find({
      _id: { $in: allRestaurantIds },
      active: true,
      approvalStatus: "approved"
    }).select("-approvalStatus -kycDocuments -commission");

     console.log(relatedRestaurants)
    // 6️⃣ Combine and deduplicate both results
    let restaurants = [...nameResults];
   
    relatedRestaurants.forEach(rest => {
      if (!restaurants.some(r => r._id.equals(rest._id))) {
        restaurants.push(rest);
      }
    });

    // 7️⃣ If location provided, apply proximity filtering
    if (location) {
      const [lng, lat] = location.split(',').map(Number);

      restaurants = await Restaurant.find({
        _id: { $in: restaurants.map(r => r._id) },
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat]
            },
            $maxDistance: radius
          }
        },
        active: true,
        approvalStatus: "approved"
      }).select("-approvalStatus -kycDocuments -commission");
    }

    // 8️⃣ Pagination logic
    const paginatedResults = restaurants.slice(skip, skip + limit);
    const totalResults = restaurants.length;

    res.json({
      success: true,
      count: paginatedResults.length,
      total: totalResults,
      page: parseInt(page),
      pages: Math.ceil(totalResults / limit),
      data: paginatedResults
    });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ success: false, message: "Server error during search" });
  }
};
