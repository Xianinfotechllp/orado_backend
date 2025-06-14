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
