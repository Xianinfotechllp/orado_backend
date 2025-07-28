/**
 * Calculates agent earnings breakdown with surge logic.
 * 
 * Applies surge only on the base fee (Option 1).
 *
 * @param {Object} options
 * @param {Number} options.distanceKm - Total distance of the delivery
 * @param {Object} options.config - Fee config { baseFee, baseKm, perKmFee }
 * @param {Array} options.surgeZones - Array of matched surge zones [{ name, surgeType, surgeValue }]
 * @returns {Object} - Detailed breakdown of earnings
 */
function calculateEarningsBreakdown({
  distanceKm = 0,
  config = {},
  surgeZones = [],
}) {
  const {
    baseFee = 0,
    baseKm = 0,
    perKmFee = 0,
  } = config;

  const distanceBeyondBase = Math.max(0, distanceKm - baseKm);
  const extraDistanceEarning = distanceBeyondBase * perKmFee;

  let surgeAmount = 0;
  const surgeDetails = [];

  for (const zone of surgeZones) {
    let surgeFee = 0;

    if (zone.surgeType === "fixed") {
      surgeFee = zone.surgeValue;
    } else if (zone.surgeType === "percentage") {
      const multiplier = zone.surgeValue / 100;
      surgeFee = baseFee * multiplier; // ✅ Only base fee is multiplied
    }

    surgeAmount += surgeFee;

    surgeDetails.push({
      name: zone.name,
      surgeType: zone.surgeType,
      surgeValue: zone.surgeValue,
      appliedSurgeFee: surgeFee,
    });
  }

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
    surgeDetails,
  };
}

module.exports = calculateEarningsBreakdown;
