function calculateEarningsBreakdown({
  distanceKm = 0,
  config = {},
  surgeZones = [],
}) {
  const {
    baseFee = 0,
    baseKm = 0,
    peakHourBonus = 0,
    rainBonus = 0,
  } = config;

  const perKmFee = config.perKmFeeBeyondBase ?? 0;

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
      surgeFee = baseFee * multiplier;
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
    perKmFee,
    distanceKm,
    distanceBeyondBase,
    extraDistanceEarning,
    surgeAmount,
    surgeDetails,
    totalEarning,
  };
}

module.exports = calculateEarningsBreakdown;
