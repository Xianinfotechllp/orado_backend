const SurgeArea = require("../../models/surgeAreaModel");

// 📌 Create a new surge area
exports.createSurgeArea = async (req, res) => {
  try {
    const {
      name,
      type,
      area,
      center,
      radius,
      surgeType,
      surgeValue,
      surgeReason,  // ✅ add this
      startTime,
      endTime
    } = req.body;

    // ✅ Basic validation
    console.log(name,type,surgeType,surgeValue,surgeReason,startTime,endTime)
    if (!name || !type || !surgeType || !surgeValue || !surgeReason || !startTime || !endTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["Polygon", "Circle"].includes(type)) {
      return res.status(400).json({ message: "Invalid area type" });
    }

    // ✅ Area type-specific validation
    if (type === "Polygon") {
      if (!area || !area.coordinates || !Array.isArray(area.coordinates)) {
        return res.status(400).json({ message: "Polygon coordinates are required" });
      }
    } else if (type === "Circle") {
      if (!center || !Array.isArray(center) || center.length !== 2 || !radius) {
        return res.status(400).json({ message: "Center [lng, lat] and radius are required for Circle" });
      }
    }

    // ✅ Create surge area
    const surgeArea = new SurgeArea({
      name,
      type,
      area: type === "Polygon" ? area : undefined,
      center: type === "Circle" ? center : undefined,
      radius: type === "Circle" ? radius : undefined,
      surgeType,
      surgeValue,
      surgeReason,   // ✅ save here too
      startTime,
      endTime
    });

    await surgeArea.save();

    res.status(201).json({
      message: "Surge area created successfully",
      data: surgeArea
    });

  } catch (err) {
    console.error("Error creating surge area:", err);
    res.status(500).json({ message: "Failed to create surge area", error: err.message });
  }
};
