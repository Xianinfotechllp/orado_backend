function calculateEarningsBreakdown({
  distanceKm = 0,
  config = {},
  surgeZones = [],
  tipAmount = 0,
  incentiveBonuses = {}, // e.g. { peakHourBonus: 0, rainBonus: 0 }
}) {
  const {
    baseFee = 0,
    baseKm = 0,
    perKmFeeBeyondBase = 0,
  } = config;

  const { peakHourBonus = 0, rainBonus = 0 } = incentiveBonuses;

  const distanceBeyondBase = Math.max(0, distanceKm - baseKm);
  const extraDistanceEarning = distanceBeyondBase * perKmFeeBeyondBase;

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

  const totalEarning = baseFee + extraDistanceEarning + surgeAmount + peakHourBonus + rainBonus + tipAmount;

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
    totalEarning,
  };
}
module.exports = calculateEarningsBreakdown;