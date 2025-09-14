function calculateEarningsBreakdown({
  distanceKm = 0,
  config = {},
  surgeZones = [],
  tipAmount = 0,
  incentiveBonuses = {}, // e.g. { peakHourBonus: 0, rainBonus: 0 }
  incentiveAmount = 0,   // total incentive for this order
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

  // Base earnings (without surge, tip, or incentives)
  const baseEarnings = baseFee + extraDistanceEarning;

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

  // Total earnings including surge, tip, and incentives
  const totalEarning =
    baseEarnings +
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
    baseEarnings, // ✅ included
    surgeAmount,
    surgeDetails,
    peakHourBonus,
    rainBonus,
    tipAmount,
    incentiveAmount,
    totalEarning,
  };
}

module.exports = calculateEarningsBreakdown;