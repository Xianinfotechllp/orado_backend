exports.deliveryFeeCalculator = ({ distanceKm, orderAmount, baseFee = 25, baseDistance = 3, perKmRate = 6, packagingFee = 10, freeDeliveryMin = 3500, surgeMultiplier = 1 }) => {
  // Free delivery if order exceeds 

  if (orderAmount >= freeDeliveryMin) return 0;

  // Calculate extra distance beyond base
  const extraDistance = Math.max(0, distanceKm - baseDistance);

  // Base + extra distance charge + packaging, multiplied by surge (if any)
  const deliveryFee = (baseFee + (extraDistance * perKmRate) + packagingFee) * surgeMultiplier;

  // Round to 2 decimal places
  return Number(deliveryFee.toFixed(2));
};



const haversine = require('haversine-distance');

exports.deliveryFeeCalculator2 = (restaurantCoords, userCoords) => {
  // Format: { lat: number, lon: number }
  const distanceInMeters = haversine(
    { lat: restaurantCoords.lat, lon: restaurantCoords.lon },
    { lat: userCoords.lat, lon: userCoords.lon }
  );

  // Example delivery fee logic
  if (distanceInMeters <= 2000) return 30;       // ₹30 for <= 2km
  if (distanceInMeters <= 5000) return 50;       // ₹50 for 2-5km
  return 70;                                      // ₹70 beyond 5km
}
