function calculateEarningsBreakdown({
  distanceKm = 0,
  config = {},
  surgeZones = [],
}) {
  const {
    baseFee = 0,
    baseKm = 0,
    perKmFeeBeyondBase = 0,
    peakHourBonus = 0,
    rainBonus = 0,
  } = config;

  // Calculate how much distance is beyond the base included distance
  const distanceBeyondBase = Math.max(0, distanceKm - baseKm);
  const extraDistanceEarning = distanceBeyondBase * perKmFeeBeyondBase;

  let surgeAmount = 0;
  const surgeDetails = [];

  for (const zone of surgeZones) {
    let surgeFee = 0;

    if (zone.surgeType === "fixed") {
      surgeFee = zone.surgeValue;
    } else if (zone.surgeType === "percentage") {
      surgeFee = baseFee * (zone.surgeValue / 100);
    }

    surgeAmount += surgeFee;

    surgeDetails.push({
      name: zone.name,
      surgeType: zone.surgeType,
      surgeValue: zone.surgeValue,
      appliedSurgeFee: surgeFee,
    });
  }

  const totalEarning = baseFee + extraDistanceEarning + surgeAmount + peakHourBonus ;

  return {
    baseFee,
    baseKm,
    perKmFee: perKmFeeBeyondBase,
    distanceKm,
    distanceBeyondBase,
    extraDistanceEarning,
    surgeAmount,
    surgeDetails,
    peakHourBonus,
    rainBonus,
    totalEarning,
  };
}

module.exports = calculateEarningsBreakdown;
