exports.deliveryFeeCalculator = ({ 
  distanceKm, 
  orderAmount, 
  baseFee = 25, 
  baseDistance = 3, 
  perKmRate = 6, 
  packagingFee = 10, 
  freeDeliveryMin = 3500, 
  surgeMultiplier = 1 
}) => {
  // Free delivery if order exceeds minimum
  if (orderAmount >= freeDeliveryMin) return 0;

  // Calculate extra distance beyond base
  const extraDistance = Math.max(0, distanceKm - baseDistance);

  // Base + extra distance charge + packaging, multiplied by surge (if any)
  const deliveryFee = (baseFee + (extraDistance * perKmRate) + packagingFee) * surgeMultiplier;

  // Round to nearest whole number
  return Math.round(deliveryFee);
};
