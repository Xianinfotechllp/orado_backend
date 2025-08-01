


const Restaurant = require("../models/restaurantModel");
const mongoose = require('mongoose');
const Category = require('../models/categoryModel');
const Product = require("../models/productModel")
const Offer = require("../models/offerModel")
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
    console.log(latitude, longitude)

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

    // Fetch restaurants in service area
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
    }).select("name address phone email serviceAreas location rating images foodType");

    // Fetch offers for each restaurant
    const restaurantsWithOffers = await Promise.all(
      restaurants.map(async (restaurant) => {
        const offers = await Offer.find({
             isActive: true,
          validFrom: { $lte: new Date() },
          validTill: { $gte: new Date() },
          applicableRestaurants: restaurant._id,
        }).select("title description type discountValue maxDiscount minOrderValue validFrom validTill");

        return {
          ...restaurant.toObject(),
          offers,  // attach offers inside each restaurant
        };
      })
    );

    // Response
    res.status(200).json({
      message: "Restaurants in your service area fetched successfully.",
      count: restaurantsWithOffers.length,
      data: restaurantsWithOffers,
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

    // Validate inputs
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const dist = parseFloat(distance);

    if (isNaN(lat)) {
      return res.status(400).json({
        message: "Invalid latitude. Must be a number between -90 and 90.",
        messageType: "failure",
        statusCode: 400,
      });
    }

    if (isNaN(lng)) {
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

    // Find nearby restaurants using GeoJSON point query
    const nearbyRestaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: dist,
        },
      },
      active: true,
    }).select("_id").lean();

    if (nearbyRestaurants.length === 0) {
      return res.status(200).json({
        message: "No nearby restaurants found.",
        messageType: "success",
        statusCode: 200,
        count: 0,
        data: [],
      });
    }

    const restaurantIds = nearbyRestaurants.map(r => r._id);

    // Get categories for these restaurants
    const categories = await Category.find({
      restaurantId: { $in: restaurantIds },
      active: true,
    }).lean();

    if (categories.length === 0) {
      return res.status(200).json({
        message: "No categories found for nearby restaurants.",
        messageType: "success",
        statusCode: 200,
        count: 0,
        data: [],
      });
    }

    // Deduplicate categories by name and count restaurants
    const categoryMap = new Map();

    categories.forEach(cat => {
      if (!categoryMap.has(cat.name)) {
        categoryMap.set(cat.name, {
          ...cat,
          restaurantCount: 1,
        });
      } else {
        const existing = categoryMap.get(cat.name);
        categoryMap.set(cat.name, {
          ...existing,
          restaurantCount: existing.restaurantCount + 1,
        });
      }
    });

    const uniqueCategories = Array.from(categoryMap.values());

    // Sort descending by restaurantCount
    uniqueCategories.sort((a, b) => b.restaurantCount - a.restaurantCount);

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
    const { latitude, longitude, maxDistance = 15000, minOrderAmount = 0 } = req.query;

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
       storeType: "restaurant",
       approvalStatus:"approved",
      active: true,
    })
      .sort({ rating: -1 })
      .limit(20)
      .select("name address minOrderAmount foodType phone rating images location");

    if (restaurants.length === 0) {
      return res.status(200).json({
        messageType: "success",
        message: "No recommended restaurants found in your area.",
        count: 0,
        data: [],
      });
    }

    // Attach offers to each restaurant
    const restaurantsWithOffers = await Promise.all(
      restaurants.map(async (restaurant) => {
        const offers = await Offer.find({
          isActive: true,
          validFrom: { $lte: new Date() },
          validTill: { $gte: new Date() },
          applicableRestaurants: restaurant._id,
        }).select("title description type discountValue maxDiscount minOrderValue validFrom validTill");

        return {
          ...restaurant.toObject(),
          offers,
        };
      })
    );

    return res.status(200).json({
      messageType: "success",
      message: "Recommended restaurants fetched successfully.",
      count: restaurantsWithOffers.length,
      data: restaurantsWithOffers,
    });

  } catch (error) {
    console.error("Error fetching recommended restaurants:", error);
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
    const {
      query,
      latitude,
      longitude,
      radius = 5000,
      limit = 10,
      page = 1
    } = req.query;
    console.log("Search query:", query, "Latitude:", latitude, "Longitude:", longitude, "Radius:", radius, "Limit:", limit, "Page:", page);

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const skip = (page - 1) * limit;

    // 1️⃣ Get restaurant IDs from products
    const productRestaurantIds = await Product.find({
      name: { $regex: query, $options: "i" },
      active: true
    }).distinct("restaurantId");

    // 2️⃣ Get restaurant IDs from categories
    const categoryRestaurantIds = await Category.find({
      name: { $regex: query, $options: "i" },
      active: true
    }).distinct("restaurantId");

    // 3️⃣ Get restaurant IDs from name or merchantSearchName
    const nameMatchedRestaurants = await Restaurant.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { merchantSearchName: { $regex: query, $options: "i" } }
      ],
      // active: true,
      approvalStatus: "approved"
    }).select("_id");

    // 4️⃣ Combine all matched restaurant IDs
    const allMatchedIds = new Set([
      ...productRestaurantIds.map(id => id.toString()),
      ...categoryRestaurantIds.map(id => id.toString()),
      ...nameMatchedRestaurants.map(r => r._id.toString())
    ]);

    if (allMatchedIds.size === 0) {
      return res.json({
        success: true,
        count: 0,
        total: 0,
        page: parseInt(page),
        pages: 0,
        data: []
      });
    }

    const finalIds = Array.from(allMatchedIds).map(id => new mongoose.Types.ObjectId(id));

    // 5️⃣ Geo + Filtered + Paginated query
    const baseQuery = {
      _id: { $in: finalIds },
      // active: true,
      approvalStatus: "approved"
    };

    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);

    const isValidLocation =
      latNum !== 0 &&
      lonNum !== 0 &&
      !isNaN(latNum) &&
      !isNaN(lonNum);

    if (isValidLocation) {
      // GeoNear with distance filter
      const geoRestaurants = await Restaurant.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            distanceField: "distance",
            maxDistance: parseFloat(radius),
            query: baseQuery,
            spherical: true
          }
        },
        {
          $project: {
            name: 1,
            merchantSearchName: 1,
            address: 1,
            images: 1,
            location: 1,
            openingHours: 1,
            createdAt: 1,
            updatedAt: 1,
            distance: 1,
            minOrderAmount: 1,
            active: 1
          }
        }
      ]);


      const total = geoRestaurants.length;
      const paginated = geoRestaurants.slice(skip, skip + parseInt(limit));

      return res.json({
        success: true,
        count: paginated.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: paginated
      });
    } else {
      // No location — basic find query
      const total = await Restaurant.countDocuments(baseQuery);

      const restaurants = await Restaurant.find(baseQuery)
        .skip(skip)
        .limit(parseInt(limit))
        .select("-approvalStatus -kycDocuments -commission");

      return res.json({
        success: true,
        count: restaurants.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: restaurants
      });
    }
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ success: false, message: "Server error during search" });
  }
};

exports.getNearbyGroceryStores = async (req, res) => {
  try {
    const { latitude, longitude, storeType, maxDistance = 15000, minOrderAmount = 0 } = req.query;

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

    const groceryStores = await Restaurant.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: maxDistance,
        },
      },
      storeType: storeType,
      minOrderAmount: { $gte: minOrder },
      approvalStatus: "approved",
      active: true,
    })
      .sort({ rating: -1 })
      .limit(20)
      .select("name address minOrderAmount phone rating images location");

    return res.status(200).json({
      messageType: "success",
      message: "Nearby grocery stores fetched successfully.",
      count: groceryStores.length,
      data: groceryStores,
    });

  } catch (error) {
    console.error("Error fetching grocery stores:", error);
    return res.status(500).json({
      messageType: "failure",
      message: "Server error while fetching grocery stores.",
    });
  }
};



exports.searchStore = async (req, res) => {
  try {
    const {
      query,
      latitude,
      longitude,
      storeType,
      radius = 1000000,
      limit = 10,
      page = 1
    } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const skip = (page - 1) * limit;
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);

    // 🔎 1. Products match
    const productRestaurantIds = await Product.find({
      name: { $regex: query, $options: "i" },
      active: true
    }).distinct("restaurantId");

    // 🔎 2. Categories match
    const categoryRestaurantIds = await Category.find({
      name: { $regex: query, $options: "i" },
      active: true
    }).distinct("restaurantId");

    // 🔎 3. Store name match
    const nameMatchedStores = await Restaurant.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { merchantSearchName: { $regex: query, $options: "i" } }
      ],
      storeType: storeType,
      approvalStatus: "approved"
    }).select("_id");

    // ✅ Combine all matched IDs
    const allMatchedIds = new Set([
      ...productRestaurantIds.map(id => id.toString()),
      ...categoryRestaurantIds.map(id => id.toString()),
      ...nameMatchedStores.map(r => r._id.toString())
    ]);

    if (allMatchedIds.size === 0) {
      return res.json({
        success: true,
        count: 0,
        total: 0,
        page: parseInt(page),
        pages: 0,
        data: []
      });
    }

    const matchedObjectIds = Array.from(allMatchedIds).map(
      id => new mongoose.Types.ObjectId(id)
    );

    // 📌 Base filter
    const baseQuery = {
      _id: { $in: matchedObjectIds },
      storeType: "grocery",
      approvalStatus: "approved",
      active: true
    };

    const isValidLocation =
      !isNaN(latNum) && !isNaN(lonNum) && latNum !== 0 && lonNum !== 0;

    // 📍 With Geo
    if (isValidLocation) {
      const geoStores = await Restaurant.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [lonNum, latNum]
            },
            distanceField: "distance",
            maxDistance: parseFloat(radius),
            query: baseQuery,
            spherical: true
          }
        },
        {
          $project: {
            name: 1,
            address: 1,
            phone: 1,
            rating: 1,
            location: 1,
            distance: 1,
            images: 1,
            minOrderAmount: 1,
            active: 1,
            openingHours: 1
          }
        }
      ]);


      const total = geoStores.length;
      const paginated = geoStores.slice(skip, skip + parseInt(limit));

      return res.json({
        success: true,
        count: paginated.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: paginated
      });
    }

    // ❌ No Geo — fallback simple query
    const total = await Restaurant.countDocuments(baseQuery);

    const fallbackStores = await Restaurant.find(baseQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .select("name address phone rating images location minOrderAmount openingHours");

    return res.json({
      success: true,
      count: fallbackStores.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: fallbackStores
    });

  } catch (error) {
    console.error("Grocery store search error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during grocery store search"
    });
  }
};

exports.searchStores = async (req, res) => {
  try {
    const {
      query,
      storeType = "grocery", // 👈 default to grocery
      latitude,
      longitude,
      radius = 5000,
      limit = 10,
      page = 1
    } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const skip = (page - 1) * limit;
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);

    // 🔎 Product matches
    const productRestaurantIds = await Product.find({
      name: { $regex: query, $options: "i" },
      active: true
    }).distinct("restaurantId");

    // 🔎 Category matches
    const categoryRestaurantIds = await Category.find({
      name: { $regex: query, $options: "i" },
      active: true
    }).distinct("restaurantId");

    // 🔎 Store name matches
    const nameMatchedStores = await Restaurant.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { merchantSearchName: { $regex: query, $options: "i" } }
      ],
      storeType: storeType, // ✅ dynamically filter by store type
      approvalStatus: "approved"
    }).select("_id");

    const allMatchedIds = new Set([
      ...productRestaurantIds.map(id => id.toString()),
      ...categoryRestaurantIds.map(id => id.toString()),
      ...nameMatchedStores.map(r => r._id.toString())
    ]);

    if (allMatchedIds.size === 0) {
      return res.json({
        success: true,
        count: 0,
        total: 0,
        page: parseInt(page),
        pages: 0,
        data: []
      });
    }

    const matchedObjectIds = Array.from(allMatchedIds).map(
      id => new mongoose.Types.ObjectId(id)
    );

    const baseQuery = {
      _id: { $in: matchedObjectIds },
      storeType: storeType,
      approvalStatus: "approved",
      active: true
    };

    const isValidLocation =
      !isNaN(latNum) && !isNaN(lonNum) && latNum !== 0 && lonNum !== 0;

    if (isValidLocation) {
      const geoStores = await Restaurant.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [lonNum, latNum] },
            distanceField: "distance",
            maxDistance: parseFloat(radius),
            query: baseQuery,
            spherical: true
          }
        },
        {
          $project: {
            name: 1,
            address: 1,
            phone: 1,
            rating: 1,
            location: 1,
            distance: 1,
            images: 1,
            minOrderAmount: 1,
            active: 1,
            openingHours: 1
          }
        }
      ]);

      const total = geoStores.length;
      const paginated = geoStores.slice(skip, skip + parseInt(limit));

      return res.json({
        success: true,
        count: paginated.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: paginated
      });
    }

    // Fallback
    const total = await Restaurant.countDocuments(baseQuery);

    const fallbackStores = await Restaurant.find(baseQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .select("name address phone rating images location minOrderAmount openingHours");

    return res.json({
      success: true,
      count: fallbackStores.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: fallbackStores
    });

  } catch (error) {
    console.error("Store search error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during store search"
    });
  }
};





exports.getNearbyMeatShops = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius = 5000, // in meters
      limit = 10,
      page = 1
    } = req.query;

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ message: "Valid latitude and longitude are required" });
    }

    const skip = (page - 1) * limit;

    const meatShops = await Restaurant.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [lon, lat]
          },
          distanceField: "distance",
          spherical: true,
          maxDistance: parseFloat(radius),
          query: {
            storeType: "meat",
            approvalStatus: "approved",
            active: true
          }
        }
      },
      {
        $sort: { distance: 1 }
      },
      {
        $project: {
          name: 1,
          address: 1,
          location: 1,
          images: 1,
          distance: 1,
          openingHours: 1,
          minOrderAmount: 1,
          rating: 1,
          phone: 1
        }
      },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    const total = await Restaurant.countDocuments({
      storeType: "meat",
      approvalStatus: "approved",
      active: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lon, lat]
          },
          $maxDistance: parseFloat(radius)
        }
      }
    });

    return res.json({
      success: true,
      data: meatShops,
      count: meatShops.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error("Nearby meat shop search error:", error);
    return res.status(500).json({ message: "Server error during nearby meat shop search" });
  }
};










exports.getNearbyStores = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius = 5000, // meters
      limit = 10,
      page = 1,
      storeType // "pharmacy", "meat", "grocery", etc.
    } = req.query;

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ message: "Valid latitude and longitude are required" });
    }

    if (!storeType) {
      return res.status(400).json({ message: "storeType is required" });
    }

    const skip = (page - 1) * limit;

    const stores = await Restaurant.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lon, lat] },
          distanceField: "distance",
          spherical: true,
          maxDistance: parseFloat(radius),
          query: {
            storeType,
            approvalStatus: "approved",
            active: true
          }
        }
      },
      { $sort: { distance: 1 } },
      {
        $project: {
          name: 1,
          address: 1,
          location: 1,
          images: 1,
          distance: 1,
          openingHours: 1,
          minOrderAmount: 1,
          rating: 1,
          phone: 1
        }
      },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    const total = await Restaurant.countDocuments({
      storeType,
      approvalStatus: "approved",
      active: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lon, lat]
          },
          $maxDistance: parseFloat(radius)
        }
      }
    });

    return res.json({
      success: true,
      data: stores,
      count: stores.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error("Nearby store search error:", error);
    return res.status(500).json({ message: "Server error during nearby store search" });
  }
};



exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id)
      .select(
        "-kyc -kycDocuments -kycStatus -kycRejectionReason -approvalRejectionReason"
      ) // Exclude KYC-related fields
      .populate("categories", "name") // Optional: populate category names
      .populate("products", "name price") // Optional: populate product names and prices
      .lean(); // Convert Mongoose doc to plain JS object

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.status(200).json(restaurant);
  } catch (error) {
    console.error("Error fetching restaurant by ID:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};