const TaxAndFeeSetting = require("../models/taxAndFeeSettingModel");
const haversine = require("haversine");
const Tax = require("../models/taxModel");
const City = require("../models/cityModel");
const {Template} = require("../models/TemplateModel")
const mongoose = require("mongoose")
const turf = require('@turf/turf');


// exports.calculateDeliveryFee = async (restaurantCoords, userCoords, orderType = 'food') => {
//   const settings = await TaxAndFeeSetting.findOne();
//   if (!settings) throw new Error("Fee settings not found.");

//   const { deliveryFeeType, baseDeliveryFee, baseDistanceKm, perKmFeeBeyondBase, orderTypeDeliveryFees, enableSurgePricing, defaultSurgeFee } = settings;

//   let deliveryFee = 0;

//   // Convert [lon, lat] → { latitude, longitude }
//   const from = { latitude: restaurantCoords[1], longitude: restaurantCoords[0] };
//   const to = { latitude: userCoords[1], longitude: userCoords[0] };
//   if (deliveryFeeType === "Fixed") {
//     deliveryFee = baseDeliveryFee;

//   } else if (deliveryFeeType === "Per KM") {
//     const distanceInKm = haversine(from, to, { unit: 'km' });
//     console.log( distanceInKm,'harver four')

//     if (distanceInKm <= baseDistanceKm) {
//       deliveryFee = baseDeliveryFee;
//     } else {
//       const extraDistance = distanceInKm - baseDistanceKm;
//       deliveryFee = baseDeliveryFee + (extraDistance * perKmFeeBeyondBase);
//     }

//   } else if (deliveryFeeType === "Per Order Type") {
//     deliveryFee = orderTypeDeliveryFees.get(orderType) || baseDeliveryFee;
//   }

//   // Apply surge pricing if enabled
//   if (enableSurgePricing) {
//     deliveryFee += defaultSurgeFee;
//   }

//   return deliveryFee;
// };

// exports.calculateDeliveryFee = async (restaurantCoords, userCoords, cityId) => {
//   const settings = await TaxAndFeeSetting.findOne();
//   if (!settings) throw new Error("Fee settings not found.");

//   const {
//     deliveryFeeType: globalDeliveryFeeType,
//     baseDeliveryFee: globalBaseFee,
//     baseDistanceKm: globalBaseDistance,
//     perKmFeeBeyondBase: globalPerKmFee,
//     enableSurgePricing,
//     defaultSurgeFee
//   } = settings;

//   let deliveryFee = 0;

//   // Convert [lon, lat] → { latitude, longitude }
//   const from = { latitude: restaurantCoords[1], longitude: restaurantCoords[0] };
//   const to = { latitude: userCoords[1], longitude: userCoords[0] };

//   let feeType = globalDeliveryFeeType;
//   let baseFee = globalBaseFee;
//   let baseDistance = globalBaseDistance;
//   let perKmFee = globalPerKmFee;

//   // check for city-specific delivery fee
//   if (cityId) {
//     const city = await City.findById(cityId);
//     if (city && city.cityDeliveryFeeSetting?.isCustomFeeEnabled) {
//       const cityFee = city.cityDeliveryFeeSetting;
//       perKmFee = cityFee.deliveryFeeType;
//       baseFee = cityFee.baseDeliveryFee;
//       perKmFee = cityFee.baseDistanceKm;
//       perKmFee = cityFee.perKmFeeBeyondBase;
//     }
//   }

//   // console.log(perKmFee,perKmFee.perKmFee)

//   // Calculate fee based on type
//   if (feeType === "Fixed") {
//     deliveryFee = baseFee;

//   } else if (feeType === "Per KM") {
//     const distanceInKm = haversine(from, to) / 1000;
//     console.log(distanceInKm, 'distance in km',from,to);

//     if (distanceInKm <= baseDistance) {
//       deliveryFee = baseFee;
//     } else {
//       const extraDistance = distanceInKm - baseDistance;
//       deliveryFee = baseFee + (extraDistance * perKmFee);
//     }
//   }

//   // Apply surge pricing if enabled
//   if (enableSurgePricing) {
//     deliveryFee += defaultSurgeFee;
//   }

//   return deliveryFee;
// };



exports.calculateDeliveryFee = async (restaurantCoords, userCoords, cityId) => {
  const settings = await TaxAndFeeSetting.findOne();
  if (!settings) throw new Error("Fee settings not found.");

  const {
    deliveryFeeType: globalDeliveryFeeType,
    baseDeliveryFee: globalBaseFee,
    baseDistanceKm: globalBaseDistance,
    perKmFeeBeyondBase: globalPerKmFee,
    enableSurgePricing,
    defaultSurgeFee
  } = settings;

  let deliveryFee = 0;

  // Convert [lon, lat] → { latitude, longitude }
  const from = { latitude: restaurantCoords[1], longitude: restaurantCoords[0] };
  const to = { latitude: userCoords[1], longitude: userCoords[0] };

  let feeType = globalDeliveryFeeType;
  let baseFee = globalBaseFee;
  let baseDistance = globalBaseDistance;
  let perKmFee = globalPerKmFee;

  // ✅ Check for city-specific delivery fee overrides
  if (cityId) {

    const city = await City.findById(cityId);
    if (city && city.cityDeliveryFeeSetting?.isCustomFeeEnabled) {
      const cityFee = city.cityDeliveryFeeSetting;

      feeType = cityFee.deliveryFeeType;
      baseFee = cityFee.baseDeliveryFee;
      baseDistance = cityFee.baseDistanceKm;
      perKmFee = cityFee.perKmFeeBeyondBase;
    }
  }

  // 🧮 Calculate fee
  if (feeType === "Fixed") {
    deliveryFee = baseFee;
  } else if (feeType === "Per KM") {
    // const distanceInKm = haversine(from, to,{ unit: 'km' }) ;

const distanceInKm = turf.distance(
  [from.longitude, from.latitude],
  [to.longitude, to.latitude],
  { units: 'kilometers' }
);

    // console.log("Distance in KM:",distanceTurf , distanceInKm, 'From:', from, 'To:', to);
    if (distanceInKm <= baseDistance) {
      deliveryFee = baseFee;
    } else {
      const extraDistance = distanceInKm - baseDistance;
      deliveryFee = baseFee + (extraDistance * perKmFee);
    }
  }

  // 🔥 Apply surge pricing if enabled
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




exports.getAllActiveTaxesv2 = async (appliedOn, cityId = null) => {
  const query = {
    appliedOn,
    status: true
  };

  // If cityId provided, add city-level filter (or global taxes)
  if (cityId) {
    const cId = mongoose.Types.ObjectId(cityId);
    query.$or = [
      { cities: cId },
      { cities: { $exists: false } }
    ];
  }

  // Fetch taxes matching the query
  const taxes = await Tax.find(query).lean();

  // Map to simple array with name, amount, and type
  const activeTaxes = taxes.map(tax => ({
    name: tax.name,
    amount: tax.amount,
    type: tax.type
  }));

  return activeTaxes;
};


// exports.getActiveTaxes = async (appliedOn, { restaurantId, cityId } = {}) => {
//   const query = {
//     appliedOn,
//     status: true
//   };

//   const andConditions = [];

//   // 📌 Restaurant-specific OR global
//   if (restaurantId) {
//     const rId = mongoose.Types.ObjectId(restaurantId);
//     andConditions.push({
//       $or: [
//         { restaurant: rId },
//         { restaurants: rId },
//         {
//           $and: [
//             { restaurant: null },
//             { restaurants: { $exists: false } }
//           ]
//         }
//       ]
//     });
//   } else {
//     // No restaurantId passed — allow global taxes
//     andConditions.push({
//       $or: [
//         { restaurant: null },
//         { restaurants: { $exists: false } }
//       ]
//     });
//   }

//   // 📌 City-specific OR global
//   if (cityId) {
//     const cId = mongoose.Types.ObjectId(cityId);
//     andConditions.push({
//       $or: [
//         { cities: cId },
//         { cities: { $exists: false } }
//       ]
//     });
//   } else {
//     // No cityId passed — allow global taxes
//     andConditions.push({
//       $or: [
//         { cities: { $exists: false } }
//       ]
//     });
//   }

//   // Only push $and if conditions exist
//   if (andConditions.length) {
//     query.$and = andConditions;
//   }

//   // Execute
//   const taxes = await Tax.find(query).lean();
//   return taxes;
// };



exports.getBillChargesAndTaxesBreakdown = async ({ appliedOn, restaurantId = null, cityId = null } = {}) => {
  const query = {
    status: true
  };

  if (appliedOn) query.appliedOn = appliedOn;

  const andConditions = [];

  // Restaurant-level or global
  if (restaurantId) {
    const rId = new mongoose.Types.ObjectId(restaurantId);
    andConditions.push({
      $or: [
        { restaurant: rId },
        { restaurants: rId },
        {
          $and: [
            { restaurant: null },
            { restaurants: { $exists: false } }
          ]
        }
      ]
    });
  } else {
    andConditions.push({
      $or: [
        { restaurant: null },
        { restaurants: { $exists: false } }
      ]
    });
  }

  // City-level or global
  if (cityId) {
    const cId = new mongoose.Types.ObjectId(cityId);
    andConditions.push({
      $or: [
        { cities: cId },
        { cities: { $exists: false } }
      ]
    });
  } else {
    andConditions.push({
      $or: [
        { cities: { $exists: false } }
      ]
    });
  }

  query.$and = andConditions;

  const taxesAndCharges = await Tax.find(query)
    .select("name amount type appliedOn taxType")
    .lean();

  return taxesAndCharges;
};




exports.calculateDeliveryFeeV2 = async (city, orderType, distance = 0) => {
  if (!city) throw new Error("City not provided");

  if (orderType === "normal") {
    if (!city.isNormalOrderActive) return 0;

    if (city.normalOrdersChargeType === "Fixed") {
      return city.fixedDeliveryChargesNormalOrders || 0;
    } else {
      const templateId = city.dynamicChargesTemplateNormalOrders;
      if (!mongoose.Types.ObjectId.isValid(templateId)) return 0;

      const template = await Template.findById(templateId).lean();
      if (!template) return 0;

      const pricingRule = template.pricingRules.find(
        (r) => r.type === "task_pricing"
      );

      if (!pricingRule) return 0;

      if (pricingRule.pricingMode === "simple") {
        const fare = pricingRule.simplePricing;
        return (fare.baseFare || 0) + (fare.distanceFare || 0) * distance;
      }

      if (pricingRule.pricingMode === "range_based") {
        const matchedRange = pricingRule.ranges.find(
          (range) =>
            distance >= range.fromDistance &&
            (range.toDistance === null || distance <= range.toDistance)
        );

        if (!matchedRange) return 0;

        return (
          (matchedRange.baseFare || 0) +
          (matchedRange.distanceFare || 0) * distance
        );
      }

      return 0;
    }
  }

  if (orderType === "custom") {
    if (!city.isCustomOrderActive) return 0;

    if (city.cityChargeType === "Fixed") {
      return city.fixedDeliveryChargesCustomOrders || 0;
    } else {
      const templateId = city.dynamicChargesTemplateNormalOrders; // or create separate dynamicChargesTemplateCustomOrders
      if (!mongoose.Types.ObjectId.isValid(templateId)) return 0;

      const template = await Template.findById(templateId).lean();
      if (!template) return 0;

      const pricingRule = template.pricingRules.find(
        (r) => r.type === "task_pricing"
      );

      console.log(pricingRule,"hi")

      if (!pricingRule) return 0;

      if (pricingRule.pricingMode === "simple") {
        const fare = pricingRule.simplePricing;
        return (fare.baseFare || 0) + (fare.distanceFare || 0) * distance;
      }

      if (pricingRule.pricingMode === "range_based") {
        const matchedRange = pricingRule.ranges.find(
          (range) =>
            distance >= range.fromDistance &&
            (range.toDistance === null || distance <= range.toDistance)
        );

        if (!matchedRange) return 0;

        return (
          (matchedRange.baseFare || 0) +
          (matchedRange.distanceFare || 0) * distance
        );
      }

      return 0;
    }
  }

  return 0;
};

// ✅ Add your new utility function here 👇
exports.calculateDeliveryFeeByCityId = async (cityId, orderType, distance = 0) => {
  if (!cityId) throw new Error("CityId not provided");

  const city = await City.findById(cityId);
  if (!city) return 0;

  return await exports.calculateDeliveryFeeV2(city, orderType, distance);
};