const mongoose = require("mongoose");
const Restaurant = require("../models/restaurantModel");
const ServiceArea = require("../models/serviceAreaModel");
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

  const result = await ServiceArea.findOne({
    restaurantId,
    area: {
      $geoIntersects: {
        $geometry: {
          type: "Point",
          coordinates: userCoords
        }
      }
    }
  });

  console.log("Checking coords:", userCoords, "for restaurant:", restaurantId);
  console.log("Geo query result:", result);

  return !!result;
};
