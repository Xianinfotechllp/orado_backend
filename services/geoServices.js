const mongoose = require("mongoose");
const Restaurant = require("../models/restaurantModel");

exports.isPointInsideServiceAreas = async (userCoords, restaurantId) => {
  if (
    !Array.isArray(userCoords) ||
    userCoords.length !== 2 ||
    typeof userCoords[0] !== "number" ||
    typeof userCoords[1] !== "number"
  ) {
    throw new Error("Invalid user coordinates");
  }

  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new Error("Invalid restaurant ID");
  }

  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    serviceAreas: {
      $geoIntersects: {
        $geometry: {
          type: "Point",
          coordinates: userCoords,
        },
      },
    },
  });

  return !!restaurant;
};
