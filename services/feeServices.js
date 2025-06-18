const TaxAndFeeSetting = require("../models/taxAndFeeSettingModel");
const haversine = require("haversine");

exports.calculateDeliveryFee = async (restaurantCoords, userCoords, orderType = 'food') => {
  const settings = await TaxAndFeeSetting.findOne();
  if (!settings) throw new Error("Fee settings not found.");

  const { deliveryFeeType, baseDeliveryFee, baseDistanceKm, perKmFeeBeyondBase, orderTypeDeliveryFees, enableSurgePricing, defaultSurgeFee } = settings;

  let deliveryFee = 0;

  // Convert [lon, lat] → { latitude, longitude }
  const from = { latitude: restaurantCoords[1], longitude: restaurantCoords[0] };
  const to = { latitude: userCoords[1], longitude: userCoords[0] };
 console.log(from,to)
  if (deliveryFeeType === "Fixed") {
    deliveryFee = baseDeliveryFee;

  } else if (deliveryFeeType === "Per KM") {
    const distanceInKm = haversine(from, to, { unit: 'km' });
    console.log( distanceInKm,'harver four')

    if (distanceInKm <= baseDistanceKm) {
      deliveryFee = baseDeliveryFee;
    } else {
      const extraDistance = distanceInKm - baseDistanceKm;
      deliveryFee = baseDeliveryFee + (extraDistance * perKmFeeBeyondBase);
    }

  } else if (deliveryFeeType === "Per Order Type") {
    deliveryFee = orderTypeDeliveryFees.get(orderType) || baseDeliveryFee;
  }

  // Apply surge pricing if enabled
  if (enableSurgePricing) {
    deliveryFee += defaultSurgeFee;
  }

  return deliveryFee;
};



exports.getActiveTaxes = async (applicableFor) => {
  const settings = await TaxAndFeeSetting.findOne();
  if (!settings) throw new Error("Tax settings not found.");

  const activeTaxes = settings.taxes
    .filter(tax => tax.applicableFor === applicableFor && tax.active)
    .map(tax => ({
      name: tax.name,
      percentage: tax.percentage
    }));

  return activeTaxes;
};