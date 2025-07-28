const SurgeArea = require("../models/surgeAreaModel");
const turf = require("@turf/turf");
const moment = require("moment");

exports.getApplicableSurgeFee = async (userCoords, orderAmount) => {
  try {
    const now = new Date();
    
    if (!Array.isArray(userCoords) || userCoords.length !== 2) {
      throw new Error('Invalid user coordinates format');
    }

    const activeSurgeAreas = await SurgeArea.find({
      isActive: true
    });

    let applicableFees = [];
   
    for (const area of activeSurgeAreas) {
      const point = turf.point(userCoords);
      console.log(userCoords)
      let isInside = false;

      if (area.type === "Polygon") {
        if (!area.area?.coordinates) continue;
        const polygon = turf.polygon(area.area.coordinates);
        isInside = turf.booleanPointInPolygon(point, polygon);
      } 
      else if (area.type === "Circle") {
        if (!area.center || !area.radius) continue;
        const center = turf.point(area.center);
        const distance = turf.distance(point, center, { units: 'meters' });
        isInside = distance <= area.radius;
      
      }

      if (isInside) {
        const fee = area.surgeType === "fixed"
          ? area.surgeValue
          : (orderAmount * area.surgeValue) / 100;

        applicableFees.push({
          fee,
          reason: area.surgeReason,
          surgeName: area.name,
          type: area.type
        });
      }
    }

    if (applicableFees.length) {
      // Pick highest fee
      const maxFeeObj = applicableFees.reduce((max, obj) => 
        obj.fee > max.fee ? obj : max
      , { fee: 0 });

      return maxFeeObj;
    }

    return null; // No surge fee applicable
  } catch (err) {
    console.error("Error calculating surge fee:", err);
    return null;
  }
};



// updated calcucaltion
exports.findApplicableSurge = (restaurantCoords, deliveryCoords, surgeAreas) => {
  const midpoint = [
    (restaurantCoords[0] + deliveryCoords[0]) / 2,
    (restaurantCoords[1] + deliveryCoords[1]) / 2,
  ];

  const point = turf.point(midpoint);

  for (const surge of surgeAreas) {
    if (!surge.isActive) continue;

    const now = new Date();
    if (now < new Date(surge.startTime) || now > new Date(surge.endTime)) {
      continue;
    }

    if (surge.type === 'Polygon' && surge.area?.coordinates) {
      const polygon = turf.polygon(surge.area.coordinates);
      if (turf.booleanPointInPolygon(point, polygon)) return surge;

    } else if (surge.type === 'Circle' && surge.center && surge.radius) {
      const center = turf.point(surge.center);
      const distance = turf.distance(center, point, { units: 'meters' });
      if (distance <= surge.radius) return surge;
    }
  }

  return null; // No surge applicable
};


exports.findApplicableSurgeZones = async ({ fromCoords, toCoords, time = new Date() }) => {
  const activeSurges = await SurgeArea.find({
    isActive: true,
    startTime: { $lte: time },
    endTime: { $gte: time }
  });

  const insideSurges = [];

  for (const surge of activeSurges) {
    if (surge.type === 'Polygon') {
      const turf = require('@turf/turf');
      const polygon = turf.polygon(surge.area.coordinates);
      const fromPoint = turf.point(fromCoords);
      const toPoint = turf.point(toCoords);

      if (turf.booleanPointInPolygon(fromPoint, polygon) || turf.booleanPointInPolygon(toPoint, polygon)) {
        insideSurges.push(surge);
      }
    } else if (surge.type === 'Circle') {
      const turf = require('@turf/turf');
      const center = turf.point(surge.center);
      const radiusInKm = surge.radius / 1000;

      const fromDistance = turf.distance(turf.point(fromCoords), center);
      const toDistance = turf.distance(turf.point(toCoords), center);

      if (fromDistance <= radiusInKm || toDistance <= radiusInKm) {
        insideSurges.push(surge);
      }
    }
  }

  return insideSurges.map(surge => ({
    name: surge.name,
    reason: surge.surgeReason,
    surgeType: surge.surgeType,
    surgeValue: surge.surgeValue,
    type: surge.type,
    id: surge._id,
  }));
};

