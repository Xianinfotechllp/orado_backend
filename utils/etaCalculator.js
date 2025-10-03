const turf = require("@turf/turf");

/**
 * Calculate ETA for an order in IST
 * @param {Array} restaurantCoords - [longitude, latitude] of restaurant
 * @param {Array} customerCoords - [longitude, latitude] of customer
 * @param {Number} preparationTime - total preparation time in minutes
 * @param {Number} averageSpeedKmPerHr - optional, default 40 km/h
 * @returns {Object} - eta timestamp in IST and total time in minutes
 */
const calculateETA = (restaurantCoords, customerCoords, preparationTime = 15, averageSpeedKmPerHr = 40) => {
  // Calculate distance in kilometers
  const distanceKm = turf.distance(
    turf.point(restaurantCoords),
    turf.point(customerCoords),
    { units: "kilometers" }
  );

  // Calculate travel time in minutes
  const travelTimeMinutes = (distanceKm / averageSpeedKmPerHr) * 60;

  // Total time = preparation + travel
  const totalTimeMinutes = preparationTime + travelTimeMinutes;

  // ETA in UTC
  const etaUTC = new Date(Date.now() + totalTimeMinutes * 60 * 1000);

  // Convert ETA to IST (+5:30)
  const istOffset = 5.5 * 60; // minutes
  const etaIST = new Date(etaUTC.getTime() + istOffset * 60 * 1000);

  return {
    eta: etaIST, // ETA in IST
    totalTimeMinutes,
    preparationTime,
    travelTimeMinutes,
    distanceKm
  };
};

module.exports = calculateETA;
