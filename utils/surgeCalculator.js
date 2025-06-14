const SurgeArea = require("../models/surgeAreaModel");
const turf = require("@turf/turf");
const moment = require("moment");

exports.getApplicableSurgeFee = async (userCoords, orderAmount) => {
  try {
    const now = new Date();

    // Fetch active surge areas currently valid by time
    const activeSurgeAreas = await SurgeArea.find({
      isActive: true,
      startTime: { $lte: now },
      endTime: { $gte: now }
    });

    let applicableFees = [];

    activeSurgeAreas.forEach(area => {
      const point = turf.point(userCoords); // [lng, lat]

      let isInside = false;

      if (area.type === "Polygon") {
        if (!area.area || !area.area.coordinates) return;
        const polygon = turf.polygon(area.area.coordinates);
        isInside = turf.booleanPointInPolygon(point, polygon);

      } else if (area.type === "Circle") {
        if (!area.center || !area.radius) return;
        const center = turf.point(area.center);
        const distance = turf.distance(point, center, { units: 'meters' });
        isInside = distance <= area.radius;
      }

      if (isInside) {
        // Calculate fee based on surgeType
        let fee = 0;
        if (area.surgeType === "fixed") {
          fee = area.surgeValue;
        } else if (area.surgeType === "percentage") {
          fee = (orderAmount * area.surgeValue) / 100;
        }

        applicableFees.push(fee);
      }
    });

    // Return highest applicable surge fee if multiple areas overlap
    const finalSurgeFee = applicableFees.length ? Math.max(...applicableFees) : 0;

    return finalSurgeFee;

  } catch (err) {
    console.error("Error calculating surge fee:", err);
    return 0;
  }
};
