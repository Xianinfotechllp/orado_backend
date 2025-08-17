function calculateEarningsBreakdown({
  distanceKm = 0,
  config = {},
  surgeZones = [],
  tipAmount = 0,
  incentiveBonuses = {}, // e.g. { peakHourBonus: 0, rainBonus: 0 }
  incentiveAmount = 0,   // ✅ New: total incentive for this order
}) {
  const {
    baseFee = 0,
    baseKm = 0,
    perKmFeeBeyondBase = 0,
  } = config;

  const { peakHourBonus = 0, rainBonus = 0 } = incentiveBonuses;

  // Distance beyond baseKm
  const distanceBeyondBase = Math.max(0, distanceKm - baseKm);
  const extraDistanceEarning = distanceBeyondBase * perKmFeeBeyondBase;

  // Surge calculation
  let surgeAmount = 0;
  const surgeDetails = [];

  for (const zone of surgeZones) {
    let surgeFee = 0;

    if (zone.surgeType === "fixed") {
      surgeFee = Number(zone.surgeValue) || 0;
    } else if (zone.surgeType === "percentage") {
      surgeFee = baseFee * ((Number(zone.surgeValue) || 0) / 100);
    }

    surgeAmount += surgeFee;

    surgeDetails.push({
      name: zone.name,
      surgeType: zone.surgeType,
      surgeValue: zone.surgeValue,
      appliedSurgeFee: surgeFee,
    });
  }

  // ✅ Total earnings including incentive
  const totalEarning =
    baseFee +
    extraDistanceEarning +
    surgeAmount +
    peakHourBonus +
    rainBonus +
    tipAmount +
    incentiveAmount;

  return {
    baseFee,
    baseKm,
    perKmFeeBeyondBase,
    distanceKm,
    distanceBeyondBase,
    extraDistanceEarning,
    surgeAmount,
    surgeDetails,
    peakHourBonus,
    rainBonus,
    tipAmount,
    incentiveAmount, // ✅ added in return object
    totalEarning,
  };
}

module.exports = calculateEarningsBreakdown;
