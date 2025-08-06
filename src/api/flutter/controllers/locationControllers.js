
const Restaurant = require("../../../../models/restaurantModel")
const Category = require("../../../../models/categoryModel")
const Product = require("../../../../models/productModel")
const { categories, restaurants } = require('../mockData')


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


exports.getNearbyRestaurants = async (req, res) => {
  try {
    const { latitude, longitude, distance = 15000 } = req.query;

    // validation blocks (same as yours)...

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const dist = parseFloat(distance);

    const restaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: distance,
        },
      },
      active: true,
      storeType:"restaurant"
    }).select("name location images");

    if (restaurants.length === 0) {
      return res.status(200).json({
        message: "No nearby restaurants found.",
        messageType: "success",
        statusCode: 200,
        count: 0,
        data: []
      });
    }

    // Map response with product availability check
    const restaurantsWithFoods = await Promise.all(restaurants.map(async (restaurant) => {
      const distanceKm = restaurant.location
        ? getDistanceFromLatLonInKm(
            lat, lng,
            restaurant.location.coordinates[1],
            restaurant.location.coordinates[0]
          )
        : null;

      let deliveryTime;
      if (distanceKm <= 2) deliveryTime = "20 mins";
      else if (distanceKm <= 5) deliveryTime = "30 mins";
      else if (distanceKm <= 8) deliveryTime = "40 mins";
      else deliveryTime = "50+ mins";

      // Get available food items for this restaurant
      const availableFoods = await Product.find({
        restaurantId: restaurant._id,
        active: true,
      })
      .select('name price images foodType specialOffer')

      // Determine if menu is available based on product count
      const productCount = availableFoods.length;
      const isMenuAvailable = productCount > 0 ? "1" : "0";

      // If no available foods, return null (we'll filter these out)
      if (availableFoods.length === 0) return null;

      // Format food items for frontend
      const formattedFoods = availableFoods.map(food => ({
        id: food._id,
        name: food.name,
        price: food.price,
        image: food.images && food.images.length > 0 ? food.images[0] : null,
        foodType: food.foodType,
        discount: food.specialOffer?.discount || 0
      }));

      return {
        shopName: restaurant.name,
        distance: distanceKm ? distanceKm.toFixed(2) : null,
        deliveryTime,
        merchantId: restaurant._id,
        isMenuAvailable, // Now based on product availability
        isAvailable: "1", // Since we're only returning restaurants with available foods
        availableFoods: formattedFoods,
        image: {
          imageName:
            restaurant.images && restaurant.images.length > 0
              ? restaurant.images[0]
              : "https://default-image-url.com/default.jpg",
        },
      };
    }));

    // Filter out null entries (restaurants with no available foods)
    const filteredRestaurants = restaurantsWithFoods.filter(restaurant => restaurant !== null);

    if (filteredRestaurants.length === 0) {
      return res.status(200).json({
        message: "No nearby restaurants with available food items found.",
        messageType: "success",
        statusCode: 200,
        count: 0,
        data: []
      });
    }

    return res.status(200).json({
      message: "Nearby restaurants with available food items fetched successfully.",
      messageType: "success",
      statusCode: 200,
      count: filteredRestaurants.length,
      data: filteredRestaurants
    });

  } catch (error) {
    console.error("Error fetching nearby restaurants:", error);
    return res.status(500).json({
      message: "Server error while fetching nearby restaurants.",
      messageType: "failure",
      statusCode: 500
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
      storeType:"restaurant"
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

    // 3. Return cegories
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





function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  ;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
}



// Utility to calculate distance between two lat-lng points (meters)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of the earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
}

exports.getNearbyCategoriesMock = async (req, res) => {
  try {
    const { latitude, longitude, distance = 5000 } = req.query;

    // Validate coordinates
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

    // Step 1: Find nearby restaurants from DB
    const nearbyRestaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: dist,
        },
      },
    }).select("_id restaurantId");

    if (!nearbyRestaurants.length) {
      return res.status(200).json({
        message: "No nearby restaurants found.",
        messageType: "success",
        statusCode: 200,
        count: 0,
        data: [],
      });
    }

    // Step 2: Get nearby restaurantIds — prefer restaurantId if present, fallback to _id string
    const nearbyRestaurantIds = nearbyRestaurants.map(r => r.restaurantId || r._id.toString());
    console.log(nearbyRestaurantIds )
    // Step 3: Filter mock categories by nearby restaurantIds
    const filteredCategories = categories.filter(cat =>
      nearbyRestaurantIds.includes(cat.restaurantId)
    );

    // Step 4: Remove duplicate categories by name (if needed)
    const uniqueCategoriesMap = new Map();
    filteredCategories.forEach(cat => {
      if (!uniqueCategoriesMap.has(cat.categoryName)) {
        uniqueCategoriesMap.set(cat.categoryName, cat);
      }
    });

    const uniqueCategories = Array.from(uniqueCategoriesMap.values());

    // Final Response
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
      active: true,
        storeType:"restaurant"
    })
      .sort({ rating: -1 })
      .limit(20);

    if (restaurants.length === 0) {
      return res.status(200).json({
        messageType: "success",
        message: "No recommended restaurants found in your area.",
        count: 0,
        data: [],
      });
    }

    // Get restaurants with available products
    const restaurantsWithFoods = await Promise.all(
      restaurants.map(async (restaurant) => {
        const distanceKm = restaurant.location
          ? getDistanceFromLatLonInKm(
              lat,
              lng,
              restaurant.location.coordinates[1],
              restaurant.location.coordinates[0]
            )
          : null;

        // Delivery time estimate based on distance
        let deliveryTime;
        if (distanceKm <= 2) deliveryTime = "20 mins";
        else if (distanceKm <= 5) deliveryTime = "30 mins";
        else if (distanceKm <= 8) deliveryTime = "40 mins";
        else deliveryTime = "50+ mins";

        // Check for available products
        const availableFoods = await Product.find({
          restaurantId: restaurant._id,
          active: true,
          stock: { $gt: 0 },
        }).select("name price images foodType specialOffer");

        const productCount = availableFoods.length;
        const isMenuAvailable = productCount > 0 ? "1" : "0";

        // If no available foods, return null (we'll filter these out)
        if (availableFoods.length === 0) return null;

        // Format food items for frontend
        const formattedFoods = availableFoods.map((food) => ({
          id: food._id,
          name: food.name,
          price: food.price,
          image: food.images && food.images.length > 0 ? food.images[0] : null,
          foodType: food.foodType,
          discount: food.specialOffer?.discount || 0,
        }));

        return {
          shopName: restaurant.name,
          distance: distanceKm ? distanceKm.toFixed(2) : null,
          deliveryTime,
          merchantId: restaurant._id,
          isMenuAvailable,
          isAvailable: "1",
          availableFoods: formattedFoods,
          image: {
            imageName:
              restaurant.images && restaurant.images.length > 0
                ? restaurant.images[0]
                : "https://default-image-url.com/default.jpg",
          },
        };
      })
    ); // <== this closing bracket was missing in your code

    // Filter out restaurants with no available products
    const filteredRestaurants = restaurantsWithFoods.filter(
      (restaurant) => restaurant !== null
    );

    if (filteredRestaurants.length === 0) {
      return res.status(200).json({
        messageType: "success",
        message:
          "No recommended restaurants with available food items found in your area.",
        count: 0,
        data: [],
      });
    }

    return res.status(200).json({
      messageType: "success",
      message:
        "Recommended restaurants with available food items fetched successfully.",
      count: filteredRestaurants.length,
      data: filteredRestaurants,
    });
  } catch (error) {
    console.error("Error fetching recommended restaurants:", error);
    return res.status(500).json({
      messageType: "failure",
      message: "Server error while fetching recommended restaurants.",
    });
  }
};
