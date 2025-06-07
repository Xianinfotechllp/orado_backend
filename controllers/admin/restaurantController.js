const Restaurant = require("../../models/restaurantModel");
const xlsx = require('xlsx')
const User = require("../../models/userModel")
const {uploadOnCloudinary} =require("../../utils/cloudinary")
const Permission = require("../../models/restaurantPermissionModel")

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