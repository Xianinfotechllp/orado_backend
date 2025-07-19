const mongoose = require("mongoose");
const Restaurant = require("../models/restaurantModel");
const ServiceArea = require("../models/serviceAreaModel");

const City = require("../models/cityModel");
const Geofence = require("../models/GeofenceModel");

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

  return !!result;
};
exports.findCityByCoordinates = async (longitude, latitude) => {
  const cities = await City.find({ status: true }).populate("geofences");

  for (const city of cities) {
    for (const fence of city.geofences) {
      if (!fence.active) continue;

      const isInside = await Geofence.findOne({
        _id: fence._id,
        geometry: {
          $geoIntersects: {
            $geometry: {
              type: "Point",
              coordinates: [parseFloat(longitude), parseFloat(latitude)],
            },
          },
        },
      });

      if (isInside) {
        return city._id; // ✅ found city
      }
    }
  }

  return null; // if no city found
};



