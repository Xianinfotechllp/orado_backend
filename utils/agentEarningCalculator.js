function calculateEarningsBreakdown({
  distanceKm = 0,
  config = {},
  surgeAmount = 0,
}) {
  const {
    baseFee = 0,
    baseKm = 0,
    perKmFee = 0,
  } = config;

  const distanceBeyondBase = Math.max(0, distanceKm - baseKm);
  const extraDistanceEarning = distanceBeyondBase * perKmFee;

  const totalEarning = baseFee + extraDistanceEarning + surgeAmount;

  return {
    baseFee,
    baseKm,
    distanceKm,
    distanceBeyondBase,
    perKmFee,
    extraDistanceEarning,
    surgeAmount,
    totalEarning,
  };
}
module.exports = calculateEarningsBreakdown;