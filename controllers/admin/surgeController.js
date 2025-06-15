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



exports.getSurgeAreas = async (req, res) => {
  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      type,
      surgeType,
      activeOnly,
      search
    } = req.query;

    // Build the query object
    const query = {};
    
    // Filter by type if provided
    if (type && ['Polygon', 'Circle'].includes(type)) {
      query.type = type;
    }
    
    // Filter by surgeType if provided
    if (surgeType) {
      query.surgeType = surgeType;
    }
    
    // Filter active only if requested
    if (activeOnly === 'true') {
      const now = new Date();
      query.startTime = { $lte: now };
      query.endTime = { $gte: now };
    }
    
    // Search by name if search term provided
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get total count for pagination info
    const total = await SurgeArea.countDocuments(query);
    
    // Fetch surge areas with sorting and pagination
    const surgeAreas = await SurgeArea.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      message: "Surge areas retrieved successfully",
      data: surgeAreas,
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });

  } catch (err) {
    console.error("Error fetching surge areas:", err);
    res.status(500).json({ 
      message: "Failed to fetch surge areas", 
      error: err.message 
    });
  }
};





exports.getSurgeAreas = async (req, res) => {
  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      type,
      surgeType,
      activeOnly,
      search
    } = req.query;

    // Build the query object
    const query = {};
    
    // Filter by type if provided
    if (type && ['Polygon', 'Circle'].includes(type)) {
      query.type = type;
    }
    
    // Filter by surgeType if provided
    if (surgeType) {
      query.surgeType = surgeType;
    }
    
    // Filter active only if requested
    if (activeOnly === 'true') {
      const now = new Date();
      query.startTime = { $lte: now };
      query.endTime = { $gte: now };
    }
    
    // Search by name if search term provided
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get total count for pagination info
    const total = await SurgeArea.countDocuments(query);
    
    // Fetch surge areas with sorting and pagination
    const surgeAreas = await SurgeArea.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      message: "Surge areas retrieved successfully",
      data: surgeAreas,
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });

  } catch (err) {
    console.error("Error fetching surge areas:", err);
    res.status(500).json({ 
      message: "Failed to fetch surge areas", 
      error: err.message 
    });
  }
};




