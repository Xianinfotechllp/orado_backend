const mongoose = require("mongoose");
const Restaurant = require("../models/restaurantModel");
const ServiceArea = require("../models/serviceAreaModel");

const City = require("../models/cityModel");
const Geofence = require("../models/GeofenceModel");



// Haversine formula (distance in meters)
const haversineDistance = ([lng1, lat1], [lng2, lat2]) => {
  const toRad = (val) => (val * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

exports.isPointInsideServiceAreas = async (userCoords, restaurantId) => {
  // Validate input coordinates
  if (
    !Array.isArray(userCoords) ||
    userCoords.length !== 2 ||
    typeof userCoords[0] !== "number" ||
    typeof userCoords[1] !== "number"
  ) {
    throw new Error("Invalid user coordinates. Must be [lng, lat]");
  }

  // Validate restaurantId
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new Error("Invalid restaurant ID");
  }

  // Fetch all service areas for this restaurant
  const serviceAreas = await ServiceArea.find({ restaurantId });

  for (const area of serviceAreas) {
    if (area.type === "Polygon") {
      // Use MongoDB geo query for polygon
      const match = await ServiceArea.findOne({
        _id: area._id,
        area: {
          $geoIntersects: {
            $geometry: {
              type: "Point",
              coordinates: userCoords
            }
          }
        }
      });

      if (match) return true;
    }

    if (area.type === "Circle") {
      // Use Haversine distance check
      const distance = haversineDistance(userCoords, area.center);
      if (distance <= area.radius) return true;
    }
  }

  return false;
};






// exports.isPointInsideServiceAreas = async (userCoords, restaurantId) => {
//   if (
//     !Array.isArray(userCoords) ||
//     userCoords.length !== 2 ||
//     typeof userCoords[0] !== "number" ||
//     typeof userCoords[1] !== "number"
//   ) {
//     throw new Error("Invalid user coordinates");
//   }

//   if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
//     throw new Error("Invalid restaurant ID");
//   }

//   const result = await ServiceArea.findOne({
//     restaurantId,
//     area: {
//       $geoIntersects: {
//         $geometry: {
//           type: "Point",
//           coordinates: userCoords
//         }
//       }
//     }
//   });

//   return !!result;
// };
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



