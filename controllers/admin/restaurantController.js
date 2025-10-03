const Restaurant = require("../../models/restaurantModel");
const xlsx = require('xlsx')
const User = require("../../models/userModel")
const {uploadOnCloudinary} =require("../../utils/cloudinary")
const Permission = require("../../models/restaurantPermissionModel")
const Product = require("../../models/productModel")
const Order = require("../../models/orderModel")
exports.getRestaurantStats = async (req, res) => {
    try {
        // Get total approved restaurants
        const totalRestaurants = await Restaurant.countDocuments({ approvalStatus: "approved" });

        // Calculate weekly growth
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const lastWeekCount = await Restaurant.countDocuments({ 
            approvalStatus: "approved",
            createdAt: { $lt: oneWeekAgo }
        });
        
        const currentWeekCount = totalRestaurants;
        const growth = currentWeekCount - lastWeekCount;
        const growthPercentage = lastWeekCount > 0 
            ? (growth / lastWeekCount) * 100 
            : currentWeekCount > 0 ? 100 : 0;

        // Format the response
        const stats = {
            totalRestaurants: totalRestaurants.toLocaleString(),
            growthPercentage: growthPercentage.toFixed(1) + '%',
            trend: growth >= 0 ? '↑' : '↓'
        };

        res.json({
            success: true,
            message: 'Restaurant statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        console.error('Error fetching restaurant stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve restaurant statistics'
        });
    }
};

exports.importMenuFromExcel = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // Read Excel File
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Assuming restaurantId is passed via query or body
    const { restaurantId } = req.body;
    if (!restaurantId) return res.status(400).json({ message: "restaurantId is required" });
    console.log(sheetData)

    // const menuItems = sheetData.map((item) => ({
    //   restaurantId: restaurantId,
    //   category: item.category || "",
    //   itemName: item.itemName,
    //   price: item.price,
    //   description: item.description || "",
    //   imageUrl: item.imageUrl || "",
    //   active: true
    // }));

    // // Insert to MongoDB
    // await Menu.insertMany(menuItems);

    // res.status(200).json({ message: "Menu items imported successfully", data: menuItems });
    res.status(200)
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to import menu", error: err.message });
  }
};



exports.createRestaurant = async (req, res) => {
  try {
    // 1️⃣ Required fields validation
    const requiredFields = [
      "name",
      "ownerName",
      "phone",
      "email",
      "fssaiNumber",
      "ownerId",
      "gstNumber",
      "aadharNumber",
      "address.street",
      "address.city",
      "address.state",
      "foodType",
      "openingHours",
    ];

    const missingFields = requiredFields.filter((field) => {
      const nestedFields = field.split(".");
      let value = req.body;
      console.log(value)
      for (const f of nestedFields) {
        value = value?.[f];
        if (value === undefined) break;
      }
      return value === undefined || value === "";
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
        code: "REQUIRED_FIELD_MISSING",
      });
    }

    // Check if owner exists
    const ownerExists = await User.findById(req.body.ownerId);
    if (!ownerExists) {
      return res.status(400).json({
        success: false,
        message: "Owner does not exist",
        code: "INVALID_OWNER_ID",
      });
    }

    // Removed the check for existing restaurant for the same owner
    // Now owners can have multiple restaurants

    const validFoodTypes = ["veg", "non-veg", "both"];
    if (!validFoodTypes.includes(req.body.foodType.trim())) {
      return res.status(400).json({
        success: false,
        message: `Invalid foodType. Allowed: ${validFoodTypes.join(", ")}`,
        code: "INVALID_FOOD_TYPE",
      });
    }

    const validateTimeFormat = (time) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let openingHours = [];

    if (req.body.openingHours) {
      try {
        openingHours = typeof req.body.openingHours === 'string'
          ? JSON.parse(req.body.openingHours)
          : req.body.openingHours;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid openingHours format. Must be valid JSON array',
          code: 'INVALID_OPENING_HOURS_FORMAT'
        });
      }

      if (!Array.isArray(openingHours)) {
        return res.status(400).json({
          success: false,
          message: 'openingHours must be an array',
          code: 'OPENING_HOURS_NOT_ARRAY'
        });
      }

      const errors = [];
      const seenDays = new Set();

      openingHours.forEach((daySchedule) => {
        const dayError = { day: daySchedule.day, errors: [] };

        if (seenDays.has(daySchedule.day)) {
          dayError.errors.push(`Duplicate entry for ${daySchedule.day}`);
          errors.push(dayError);
          return;
        }
        seenDays.add(daySchedule.day);

        if (!validDays.includes(daySchedule.day)) {
          dayError.errors.push(`Invalid day name. Allowed: ${validDays.join(', ')}`);
        }

        if (daySchedule.isClosed) {
          if (dayError.errors.length > 0) errors.push(dayError);
          return;
        }

        if (!daySchedule.openingTime || !validateTimeFormat(daySchedule.openingTime)) {
          dayError.errors.push('openingTime must be in HH:MM format');
        }

        if (!daySchedule.closingTime || !validateTimeFormat(daySchedule.closingTime)) {
          dayError.errors.push('closingTime must be in HH:MM format');
        }

        if (daySchedule.openingTime && daySchedule.closingTime) {
          if (daySchedule.closingTime <= '04:00' && daySchedule.openingTime > daySchedule.closingTime) {
            // Overnight case — valid
          } else if (daySchedule.openingTime >= daySchedule.closingTime) {
            dayError.errors.push('closingTime must be after openingTime');
          }
        }

        if (dayError.errors.length > 0) {
          errors.push(dayError);
        }
      });

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid opening hours data',
          code: 'INVALID_OPENING_HOURS_DATA',
          errors
        });
      }
    }

    const requiredDocs = {
      fssaiDoc: "FSSAI License",
      gstDoc: "GST Certificate",
      aadharDoc: "Aadhar Card",
    };

    const missingDocs = Object.keys(requiredDocs)
      .filter((doc) => !req.files?.[doc]?.[0])
      .map((doc) => requiredDocs[doc]);

    if (missingDocs.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing documents: ${missingDocs.join(", ")}`,
        code: "DOCUMENT_REQUIRED",
      });
    }

    const allowedPaymentMethods = ["online", "cod", "wallet"];
    let paymentMethods = req.body.paymentMethods;

    if (typeof paymentMethods === "string") {
      paymentMethods = paymentMethods.split(",").map((m) => m.trim());
    } else if (!paymentMethods) {
      paymentMethods = ["online"];
    }

    const invalidMethods = paymentMethods.filter(
      (m) => !allowedPaymentMethods.includes(m)
    );
    if (invalidMethods.length) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment methods: ${invalidMethods.join(
          ", "
        )}. Allowed: ${allowedPaymentMethods.join(", ")}`,
      });
    }

    const fssaiDoc = await uploadOnCloudinary(req.files.fssaiDoc[0].path);
    const gstDoc = await uploadOnCloudinary(req.files.gstDoc[0].path);
    const aadharDoc = await uploadOnCloudinary(req.files.aadharDoc[0].path);

    if (!fssaiDoc || !gstDoc || !aadharDoc) {
      throw new Error("Document upload failed");
    }
    if (req.files?.images && req.files.images.length > 5) {
  return res.status(400).json({
    success: false,
    message: "Maximum 5 images allowed",
    code: "TOO_MANY_IMAGES",
  });
}


 let imageUrls = [];
    if (req.files?.images) {
      // Upload each image to Cloudinary
      const uploadPromises = req.files.images.map(file => 
        uploadOnCloudinary(file.path)
      );
      
      const uploadResults = await Promise.all(uploadPromises);
      imageUrls = uploadResults
        .filter(result => result !== undefined)
        .map(result => result.secure_url);
    }
    




    const slug = `${req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${req.body.address.city.toLowerCase()}-${Math.random().toString(36).substring(2, 6)}`;

    const restaurantData = {
      name: req.body.name.trim(),
      ownerId: req.body.ownerId, // Using the validated ownerId
      ownerName: req.body.ownerName.trim(),
      address: {
        street: req.body.address.street.trim(),
        city: req.body.address.city.trim(),
        state: req.body.address.state.trim(),
        zip: req.body.address.pincode || req.body.address.zip || "",
      },
      location: {
        type: "Point",
        coordinates: [
          parseFloat(req.body.address.longitude) || 0,
          parseFloat(req.body.address.latitude) || 0,
        ],
      },
      phone: req.body.phone.trim(),
      email: req.body.email.trim(),
      openingHours,
      foodType: req.body.foodType.trim(),
      minOrderAmount: req.body.minOrderAmount || 100,
      paymentMethods,
      kyc: {
        fssaiNumber: req.body.fssaiNumber.trim(),
        gstNumber: req.body.gstNumber.trim(),
        aadharNumber: req.body.aadharNumber.trim(),
      },
      kycDocuments: {
        fssaiDocUrl: fssaiDoc.secure_url,
        gstDocUrl: gstDoc.secure_url,
        aadharDocUrl: aadharDoc.secure_url,
      },
      images: imageUrls,
      slug
    };

    const newRestaurant = await Restaurant.create(restaurantData);

    await Permission.create({
      restaurantId: newRestaurant._id,
      permissions: {
        canManageMenu: true,
        canAcceptOrder: false,
        canRejectOrder: false,
        canManageOffers: false,
        canViewReports: true,
      },
    });

    return res.status(201).json({
      success: true,
      code: "RESTAURANT_CREATED",
      data: {
        restaurantId: newRestaurant._id,
        approvalStatus: newRestaurant.approvalStatus,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: err.message,
    });
  }
};



exports.setRestaurantCommission = async (req, res) => {
   try {
    const { restaurantId } = req.params;
    const { type, value } = req.body

    // Find restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    // Validate commission value
    if (type === "percentage" && (value < 0 || value > 100)) {
      return res.status(400).json({ error: "Percentage must be 0-100" });
    }

    // Update commission
    restaurant.commission = { type, value };
    await restaurant.save();

    res.json({ message: "Commission updated", restaurant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};




exports.getAllRestaurantsDropdown = async (req, res) => {
  try {
    // Fetch only active restaurants for dropdown
    const restaurants = await Restaurant.find({ active: true })
      .select("_id name")
      .sort({ name: 1 }) // alphabetically sort
      .lean();

    return res.status(200).json({
      success: true,
      message: "Restaurants fetched successfully.",
      data: restaurants
    });
    
  } catch (error) {
    console.error("Error fetching restaurant list:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch restaurant list."
    });
  }
};

exports.getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({})
      .sort({ createdAt: -1 }); // latest first

    // Map the data into your desired frontend format
    const formattedRestaurants = restaurants.map((restaurant) => ({
      id: restaurant._id,
      name: restaurant.name,
      address: `${restaurant.address.street}, ${restaurant.address.city}, ${restaurant.address.state}, ${restaurant.address.zip}`,
      phone: restaurant.phone,
      email: restaurant.email,
      rating: restaurant.rating ? `${restaurant.rating} / 5` : "NA",
      servicable: restaurant.active ? "OPEN" : "CLOSED",
      stripeStatus: "-", // you can link this if you have stripe status in schema
      city: restaurant.address.city || "-",
      registeredOn: restaurant.createdAt
  ? new Date(restaurant.createdAt).toLocaleString("en-US", { hour12: true })
  : "-"
    }));

    res.status(200).json({
      messageType: "success",
      data: formattedRestaurants,
    });
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    res.status(500).json({
      messageType: "failure",
      message: "Failed to fetch restaurants",
    });
  }
};









exports.getAllRestaurantsForMap = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ active: true }); // Only active ones if you want

    const formattedRestaurants = restaurants.map((restaurant) => ({
      id: restaurant._id,
      name: restaurant.name,
      lng: restaurant.location.coordinates[0],
      lat: restaurant.location.coordinates[1],
      rating: restaurant.rating || 0,
    }));

    res.status(200).json({
      messageType: "success",
      data: formattedRestaurants,
    });
  } catch (error) {
    console.error("Error fetching restaurants for map:", error);
    res.status(500).json({
      messageType: "failure",
      message: "Failed to fetch restaurant locations",
    });
  }
};



exports.getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.status(200).json({
      message: "Restaurant fetched successfully",
      data: restaurant,
    });
  } catch (error) {
    console.error("Error fetching restaurant:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};





exports.updateRestaurantProfile = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      name,
      email,
      phone,
      foodType,
      description,
      status,
      approvalStatus,
      kycStatus,
      street,
      city,
      state,
      zip,
      displayAddress
    } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // ✅ Update text/input fields
    if (name) restaurant.name = name;
    if (email) restaurant.email = email;
    if (phone) restaurant.phone = phone;
    if (foodType) restaurant.foodType = foodType;
    if (description) restaurant.description = description;
    if (status !== undefined) restaurant.active = status;
    if (approvalStatus) restaurant.approvalStatus = approvalStatus;
    if (kycStatus) restaurant.kycStatus = kycStatus;

    // ✅ Update address
    if (street) restaurant.address.street = street;
    if (city) restaurant.address.city = city;
    if (state) restaurant.address.state = state;
    if (zip) restaurant.address.zip = zip;
    if (displayAddress) restaurant.displayAddress = displayAddress;

    // ✅ Upload multiple images and push to images array
    if (req.files && req.files.length > 0) {
      const uploadedImages = [];
      for (const file of req.files) {
        const result = await uploadOnCloudinary(file.path, "orado_restaurants");
        if (result) {
          uploadedImages.push(result.secure_url);
        }
      }
      restaurant.images.push(...uploadedImages);
    }

    await restaurant.save();

    res.json({
      message: "Restaurant profile updated successfully",
      data: restaurant,
    });

  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


exports.getProductsByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: "restaurantId is required"
      });
    }

    const products = await Product.find({ restaurantId })
      .select('name price specialOffer') // only fetch relevant fields
      .lean();

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: products
    });

  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};



// Get opening hours with better response structure
exports.getOpeningHours = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId)
      .select("openingHours")
      .lean();

    if (!restaurant) {
      return res.status(404).json({ 
        success: false,
        message: "Restaurant not found",
        data: null
      });
    }

    res.status(200).json({
      success: true,
      message: "Opening hours retrieved successfully",
      data: restaurant.openingHours
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve opening hours",
      error: error.message,
      data: null
    });
  }
};

// Update opening hours with better validation and response
exports.updateOpeningHours = async (req, res) => {
  try {
    const { openingHours } = req.body;

    // Validate input exists
    if (!openingHours || !Array.isArray(openingHours)) {
      return res.status(400).json({
        success: false,
        message: "Opening hours data is required and must be an array",
        data: null
      });
    }

    // Validate all days are present
    const requiredDays = [
      "monday", "tuesday", "wednesday", 
      "thursday", "friday", "saturday", "sunday"
    ];

    const receivedDays = openingHours.map(h => h.day.toLowerCase());
    const missingDays = requiredDays.filter(day => !receivedDays.includes(day));

    if (missingDays.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing opening hours for: ${missingDays.join(", ")}`,
        data: null,
        missingDays
      });
    }

    // Validate time format (basic check)
    const invalidTimes = openingHours.filter(hour => {
      return !hour.isClosed && (!isValidTime(hour.openingTime) || !isValidTime(hour.closingTime));
    });

    if (invalidTimes.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid time format (use HH:MM)",
        data: null,
        invalidEntries: invalidTimes.map(t => t.day)
      });
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.restaurantId,
      { openingHours },
      { new: true, runValidators: true }
    ).select("openingHours");

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
        data: null
      });
    }

    res.status(200).json({
      success: true,
      message: "Opening hours updated successfully",
      data: restaurant.openingHours
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update opening hours",
      error: error.message,
      data: null
    });
  }
};

// Helper function to validate time format
function isValidTime(time) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}
// Get current status (open/closed)
exports.getCurrentStatus = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId)
      .select("openingHours")
      .lean();

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const now = new Date();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const currentTime = now.toTimeString().slice(0, 5);

    const todayHours = restaurant.openingHours.find(
      (h) => h.day === currentDay
    );

    if (!todayHours || todayHours.isClosed) {
      return res.json({ status: "closed" });
    }

    if (currentTime >= todayHours.openingTime && currentTime <= todayHours.closingTime) {
      return res.json({ status: "open" });
    }

    res.json({ status: "closed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getStoresByRevenue = async (req, res) => {
  try {
    const period = req.query.period || "daily"; // daily, weekly, monthly, yearly
    const { startDate: customStart, endDate: customEnd } = req.query; // optional custom dates
    let startDate, endDate;
    const today = new Date();

    if (customStart && customEnd) {
      // Use custom dates if provided
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      // Determine period
      endDate = new Date(today); // now
      if (period === "daily") {
        startDate = new Date(today.setHours(0, 0, 0, 0));
      } else if (period === "weekly") {
        const firstDayOfWeek = today.getDate() - today.getDay(); // Sunday as first day
        startDate = new Date(today.setDate(firstDayOfWeek));
        startDate.setHours(0, 0, 0, 0);
      } else if (period === "monthly") {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1); // 1st of month
      } else if (period === "yearly") {
        startDate = new Date(today.getFullYear(), 0, 1); // Jan 1st of this year
      } else {
        // default fallback
        startDate = new Date(today.setHours(0, 0, 0, 0));
      }
    }

    const result = await Order.aggregate([
      {
        $match: {
          orderStatus: "delivered",
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$restaurantId",
          totalRevenue: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "restaurants",
          localField: "_id",
          foreignField: "_id",
          as: "restaurant"
        }
      },
      { $unwind: "$restaurant" },
      {
        $project: {
          _id: 1,
          totalRevenue: 1,
          orderCount: 1,
          restaurant: { _id: 1, name: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.status(200).json({
      success: true,
      message: "Stores revenue fetched successfully",
      data: result
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching stores revenue",
      error: err.message
    });
  }
};



exports.getPlatformSalesGraphData = async (req, res) => {
  try {
    const period = req.query.period || "daily"; // daily, weekly, monthly, yearly
    const { startDate: customStart, endDate: customEnd } = req.query;

    let startDate, endDate;
    const today = new Date();

    // ------------------ Set date range ------------------
    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      endDate = new Date(today);
      if (period === "daily") startDate = new Date(today.setHours(0,0,0,0));
      else if (period === "weekly") {
        const firstDayOfWeek = today.getDate() - today.getDay(); // Sunday as first
        startDate = new Date(today.setDate(firstDayOfWeek));
        startDate.setHours(0,0,0,0);
      }
      else if (period === "monthly") startDate = new Date(today.getFullYear(), today.getMonth(),1);
      else if (period === "yearly") startDate = new Date(today.getFullYear(),0,1);
    }

    // ------------------ Revenue Overview ------------------
    let groupIdRevenue;
    if (period === "daily" || customStart || customEnd) {
      groupIdRevenue = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } };
    } else if (period === "weekly") groupIdRevenue = { year: { $year: "$createdAt" }, week: { $week: "$createdAt" } };
    else if (period === "monthly") groupIdRevenue = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } };
    else if (period === "yearly") groupIdRevenue = { year: { $year: "$createdAt" } };

    const revenueData = await Order.aggregate([
      { $match: { orderStatus: "delivered", createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: groupIdRevenue, totalRevenue: { $sum: "$totalAmount" }, totalOrders: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    // Format revenue for graph
    const revenueOverview = revenueData.map(r => {
      if (r._id.day) {
        const d = new Date(r._id.year, r._id.month - 1, r._id.day);
        const weekday = d.toLocaleString("en-US", { weekday: "short" }); // Mon, Tue
        return { day: weekday, totalRevenue: r.totalRevenue, totalOrders: r.totalOrders };
      } else if (r._id.week) return { day: `W${r._id.week}`, totalRevenue: r.totalRevenue, totalOrders: r.totalOrders };
      else if (r._id.month) return { day: `${r._id.year}-${r._id.month}`, totalRevenue: r.totalRevenue, totalOrders: r.totalOrders };
      else return { day: `${r._id.year}`, totalRevenue: r.totalRevenue, totalOrders: r.totalOrders };
    });

    // ------------------ Peak Hours Analysis ------------------
    const peakHoursData = await Order.aggregate([
      { $match: { orderStatus: "delivered", createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { hour: { $hour: "$createdAt" } }, totalOrders: { $sum: 1 }, totalRevenue: { $sum: "$totalAmount" } } },
      { $sort: { "_id.hour": 1 } }
    ]);

    const peakHours = peakHoursData.map(p => {
      const hour12 = p._id.hour % 12 === 0 ? 12 : p._id.hour % 12;
      const ampm = p._id.hour < 12 ? "AM" : "PM";
      return { hour: `${hour12}${ampm}`, totalOrders: p.totalOrders, totalRevenue: p.totalRevenue };
    });

    // ------------------ Total Revenue & Orders ------------------
    const totalRevenue = revenueOverview.reduce((acc, cur) => acc + cur.totalRevenue, 0);
    const totalOrders = revenueOverview.reduce((acc, cur) => acc + cur.totalOrders, 0);

    // ------------------ Send Response ------------------
    res.status(200).json({
      success: true,
      data: {
        revenueOverview,
        peakHours,
        totalRevenue,
        totalOrders
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching graph data", error: err.message });
  }
};



