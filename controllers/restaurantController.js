const Restaurant = require("../models/restaurantModel");
const RestaurantEarning = require("../models/RestaurantEarningModel");
const Permission = require("../models/restaurantPermissionModel");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { uploadOnCloudinary } = require("../utils/cloudinary");
const Session = require("../models/session");
const User = require("../models/userModel");
const Offer = require("../models/offerModel");
const moment = require("moment");
const { Types } = require("mongoose");
const ServiceArea = require("../models/serviceAreaModel");
const parseCoordinates = require("../utils/parseCoordinates");


exports.createRestaurant = async (req, res) => {
  try {
    // 1️⃣ Required fields validation (removed password, ownerName, email, phone)
    const requiredFields = [
      "name",
      "ownerId",
      "fssaiNumber",
      "ownerId",
      "gstNumber",
      "aadharNumber",
      "address.street",
      "address.city",
      "address.state",
      "foodType",
      "openingHours",
      "storeType"
    ];

    const missingFields = requiredFields.filter((field) => {
      const nestedFields = field.split(".");
      let value = req.body;
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

    // 2️⃣ Get owner details from database using ownerId
    const owner = await User.findById(req.body.ownerId);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
        code: "OWNER_NOT_FOUND",
      });
    }

    const validFoodTypes = ["veg", "non-veg", "both"];
    if (!validFoodTypes.includes(req.body.foodType.trim())) {
      return res.status(400).json({
        success: false,
        message: `Invalid foodType. Allowed: ${validFoodTypes.join(", ")}`,
        code: "INVALID_FOOD_TYPE",
      });
    }
    const validStoreTypes = ["restaurant", "grocery", "meat", "pharmacy"];
    if (!validStoreTypes.includes(req.body.storeType?.trim())) {
      return res.status(400).json({
        success: false,
        message: `Invalid storeType. Allowed: ${validStoreTypes.join(", ")}`,
        code: "INVALID_STORE_TYPE",
      });
    }


    const validateTimeFormat = (time) =>
      /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    const validDays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    let openingHours = [];

    if (req.body.openingHours) {
      try {
        openingHours =
          typeof req.body.openingHours === "string"
            ? JSON.parse(req.body.openingHours)
            : req.body.openingHours;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid openingHours format. Must be valid JSON array",
          code: "INVALID_OPENING_HOURS_FORMAT",
        });
      }

      if (!Array.isArray(openingHours)) {
        return res.status(400).json({
          success: false,
          message: "openingHours must be an array",
          code: "OPENING_HOURS_NOT_ARRAY",
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
          dayError.errors.push(
            `Invalid day name. Allowed: ${validDays.join(", ")}`
          );
        }

        if (daySchedule.isClosed) {
          if (dayError.errors.length > 0) errors.push(dayError);
          return;
        }

        if (
          !daySchedule.openingTime ||
          !validateTimeFormat(daySchedule.openingTime)
        ) {
          dayError.errors.push("openingTime must be in HH:MM format");
        }

        if (
          !daySchedule.closingTime ||
          !validateTimeFormat(daySchedule.closingTime)
        ) {
          dayError.errors.push("closingTime must be in HH:MM format");
        }

        if (daySchedule.openingTime && daySchedule.closingTime) {
          if (
            daySchedule.closingTime <= "04:00" &&
            daySchedule.openingTime > daySchedule.closingTime
          ) {
            // Overnight case — valid
          } else if (daySchedule.openingTime >= daySchedule.closingTime) {
            dayError.errors.push("closingTime must be after openingTime");
          }
        }

        if (dayError.errors.length > 0) {
          errors.push(dayError);
        }
      });

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid opening hours data",
          code: "INVALID_OPENING_HOURS_DATA",
          errors,
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

    let imageUrls = [];
    if (req.files && req.files.images && Array.isArray(req.files.images)) {
      for (const file of req.files.images) {
        const uploaded = await uploadOnCloudinary(file.path);
        if (uploaded?.secure_url) imageUrls.push(uploaded.secure_url);
      }
    }

    // 8️⃣ Slug generation
    const slug = `${req.body.name
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )}-${req.body.address.city.toLowerCase()}-${Math.random()
      .toString(36)
      .substring(2, 6)}`;

    // 9️⃣ Final restaurant data prep
    const restaurantData = {
      name: req.body.name.trim(),
      ownerId: req.body.ownerId, // Store owner reference
      ownerName: owner.name, // Get from owner document
      address: {
        street: req.body.address.street.trim(),
        city: req.body.address.city.trim(),
        state: req.body.address.state.trim(),
        zip: req.body.address.pincode || req.body.address.zip || "",
      },
      storeType: req.body.storeType.trim(),
      location: {
        type: "Point",
        coordinates: [
          parseFloat(req.body.address.longitude) || 0,
          parseFloat(req.body.address.latitude) || 0,
        ],
      },
      phone: owner.phone, // Get from owner document
      email: owner.email, // Get from owner document
      openingHours,
      foodType: req.body.foodType.trim(),
      minOrderAmount: req.body.minOrderAmount || 100,
      paymentMethods,
      images: imageUrls,
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
      slug,
    };

    const newRestaurant = await Restaurant.create(restaurantData);

    await Permission.create({
      restaurantId: newRestaurant._id,
      userId: req.body.ownerId, // Assign permissions to owner
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

exports.getRestaurantsByMerchantId = async (req, res) => {
  try {
    // 1️⃣ Validate merchant ID
    const merchantId = req.user._id;
    if (!merchantId || !mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID",
        code: "INVALID_MERCHANT_ID",
      });
    }

    // 2️⃣ Check if merchant exists
    const merchant = await User.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
        code: "MERCHANT_NOT_FOUND",
      });
    }
    console.log("Merchant found:", merchant.name);

    // 3️⃣ Get all restaurants for this merchant
    const restaurants = await Restaurant.find({ ownerId: merchantId })
      .select("-kycDocuments -__v") // leave out location, it'll be included by default
      .lean();

    // 4️⃣ Format response with status information
    const formattedRestaurants = restaurants.map((restaurant) => ({
      id: restaurant._id,
      name: restaurant.name,
      storeType:restaurant.storeType,
      address: restaurant.address,
      phone: restaurant.phone,
      email: restaurant.email,
      foodType: restaurant.foodType,
      status: restaurant.approvalStatus,
      isActive: restaurant.active,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
      minOrderAmount:restaurant.minOrderAmount,
      location: restaurant.location,
        openingHours: restaurant.openingHours,
        images:restaurant.images
    }));
    console.log("Formatted restaurants:", formattedRestaurants.length);

    return res.status(200).json({
      success: true,
      code: "RESTAURANTS_FETCHED",
      data: {
        merchant: {
          id: merchant._id,
          name: merchant.name,
          email: merchant.email,
          phone: merchant.phone,
        },
        restaurants: formattedRestaurants,
        count: formattedRestaurants.length,
      },
    });
  } catch (err) {
    console.error("Error fetching merchant restaurants:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch restaurants",
      error: err.message,
      code: "SERVER_ERROR",
    });
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    if (!req.body)
      return res.status(400).json({ message: "Request body is missing." });
 console.log("updte")
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found." });

    // Parse address if it's a JSON string
    if (typeof req.body.address === "string") {
      try {
        req.body.address = JSON.parse(req.body.address);
      } catch (e) {
        console.error("Failed to parse address JSON:", e);
        return res.status(400).json({ message: "Invalid address format." });
      }
    }

    const {
      name,
      address,
      phone,
      email,
      openingHours,
      foodType,
      merchantSearchName,
      minOrderAmount,
      paymentMethods,
      isActive,
      status,
    } = req.body;
   console.log(req.body)
    // Update basic fields if provided
    if (name) restaurant.name = name;
    if (phone) restaurant.phone = phone;
    if (email) restaurant.email = email;
    if (foodType) restaurant.foodType = foodType;
    if (merchantSearchName) restaurant.merchantSearchName = merchantSearchName;
    if (minOrderAmount) restaurant.minOrderAmount = minOrderAmount;

    // Parse payment methods if string
    if (paymentMethods) {
      try {
        restaurant.paymentMethods =
          typeof paymentMethods === "string"
            ? JSON.parse(paymentMethods)
            : paymentMethods;
      } catch (e) {
        console.error("Failed to parse paymentMethods:", e);
        return res
          .status(400)
          .json({ message: "Invalid format for paymentMethods" });
      }
    }

    // Parse and update opening hours
    if (openingHours) {
      try {
        const hoursData =
          typeof openingHours === "string"
            ? JSON.parse(openingHours)
            : openingHours;

        restaurant.openingHours = hoursData.map((hour) => ({
          day: hour.day,
          openingTime: hour.openingTime || hour.open,
          closingTime: hour.closingTime || hour.close,
          isClosed: hour.isClosed || false,
        }));
      } catch (e) {
        console.error("Error parsing opening hours:", e);
      }
    }

    if (isActive !== undefined) restaurant.isActive = isActive;
    if (status) restaurant.status = status;

    // Update address and coordinates if provided
 if (address) {
  restaurant.address.street = address?.street || restaurant.address.street;
  restaurant.address.city = address?.city || restaurant.address.city;
  restaurant.address.state = address?.state || restaurant.address.state;
  restaurant.address.zip = address?.pincode || restaurant.address.zip;

  if (address.coordinates) {
    const parsedCoords = parseCoordinates(address.coordinates);
    if (parsedCoords) {
      restaurant.location = {
        type: "Point",
        coordinates: parsedCoords,
      };
    }
  }
}

// If location object is provided in req.body.location
if (req.body.location) {
  const { longitude, latitude } = req.body.location;
  if (longitude !== undefined && latitude !== undefined) {
    const parsedCoords = parseCoordinates([longitude, latitude]);
    if (parsedCoords) {
      restaurant.location = {
        type: "Point",
        coordinates: parsedCoords,
      };
    }
  }
}

    // Log coordinates for debugging
    // console.log("Updated res", restaurant);

    // Handle file uploads if any
    if (req.files) {
      const uploadPromises = Object.entries(req.files).flatMap(
        ([field, fileArray]) =>
          fileArray.map(async (file) => {
            const result = await uploadOnCloudinary(file.path);
            if (result && result.secure_url) {
              if (field === "fssaiDoc")
                restaurant.kycDocuments.fssaiDocUrl = result.secure_url;
              if (field === "gstDoc")
                restaurant.kycDocuments.gstDocUrl = result.secure_url;
              if (field === "aadharDoc")
                restaurant.kycDocuments.aadharDocUrl = result.secure_url;
              if (field === "images") restaurant.images.push(result.secure_url);
            }
          })
      );
      await Promise.all(uploadPromises);
    }

    await restaurant.save();
    res.status(200).json({
      message: "Restaurant updated successfully.",
      restaurant,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error.", error });
  }
};

exports.toggleActiveStatus = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Find the restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }
    
    // Check if user has permission to toggle status
    // You might want to add authorization logic here
    // For example, only admin or owner can toggle status
    
    // Toggle the active status
    restaurant.active = !restaurant.active;
    
    // Save the updated restaurant
    await restaurant.save();
    
    res.status(200).json({ 
      success: true, 
      message: `Restaurant status updated to ${restaurant.active ? "active" : "inactive"}`,
      data: {
        active: restaurant.active
      }
    });
    
  } catch (error) {
    console.error("Error toggling restaurant status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}







exports.deleteRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurantId format." });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    // Delete the restaurant
    await restaurant.deleteOne();

    //  Also delete the associated permission
    await Permission.deleteOne({ restaurantId });

    res.status(200).json({
      message: "Restaurant and its permissions deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting restaurant:", error);
    res.status(500).json({ message: "Server error." });
  }
};









exports.updateBasicInfo = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    console.log(restaurantId)
    const {
      name,
      phone,
      email,
      foodType,
      minOrderAmount,
      active,
      ownerName,
      approvalStatus,
      approvalRejectionReason
    } = req.body;

    // Build update object dynamically
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (foodType !== undefined) updateData.foodType = foodType;
    if (minOrderAmount !== undefined) updateData.minOrderAmount = minOrderAmount;
    if (active !== undefined) updateData.active = active;
    if (ownerName !== undefined) updateData.ownerName = ownerName;
    if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;
    if (approvalRejectionReason !== undefined) updateData.approvalRejectionReason = approvalRejectionReason;

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(restaurantId, updateData, {
      new: true,
    });

    if (!updatedRestaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    res.status(200).json({
      message: "Basic information updated successfully",
      restaurant: updatedRestaurant,
    });

  } catch (error) {
    console.error("Error updating basic info:", error);
    res.status(500).json({ message: "Server error", error });
  }
};










exports.updateLocationInfo = async (req, res) => {
  try {
    const {restaurantId } = req.params;
    const { longitude, latitude } = req.body;

    if (longitude === undefined || latitude === undefined) {
      return res.status(400).json({ message: "Longitude and latitude are required." });
    }

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      {
        $set: {
          "location.type": "Point",
          "location.coordinates": [longitude, latitude],
        },
      },
      { new: true }
    );

    if (!updatedRestaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    res.status(200).json({
      message: "Location updated successfully.",
      restaurant: updatedRestaurant,
    });
  } catch (error) {
    console.error("Error updating location info:", error);
    res.status(500).json({ message: "Server error", error });
  }
};















exports.getRestaurantById = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required." });
    }
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurantId format." });
    }

    // Find restaurant
    const restaurant = await Restaurant.findById(restaurantId).lean();
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    const currentDate = new Date();

    // Fetch only valid and active offers for this restaurant
    const offers = await Offer.find({
      applicableRestaurants: restaurantId,
      isActive: true,
      validFrom: { $lte: new Date() },
      validTill: { $gte: new Date() },
    });

    // Add offers to restaurant object
    restaurant.offers = offers;

    res.status(200).json({
      message: "Restaurant fetched successfully.",
      data: restaurant, // directly sending restaurant here
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

exports.updateBusinessHours = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { businessHours } = req.body;

    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res
        .status(400)
        .json({ message: "Invalid or missing restaurantId." });
    }

    if (!businessHours || typeof businessHours !== "object") {
      return res
        .status(400)
        .json({ message: "businessHours must be a valid object." });
    }

    const validDays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    for (const [day, times] of Object.entries(businessHours)) {
      if (!validDays.includes(day)) {
        return res.status(400).json({ message: `Invalid day: ${day}` });
      }

      const { startTime, endTime, closed } = times;

      if (closed === true) continue;

      if (!startTime || !endTime) {
        return res
          .status(400)
          .json({ message: `Missing startTime or endTime for ${day}.` });
      }

      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res
          .status(400)
          .json({ message: `Invalid time format for ${day}. Use HH:mm.` });
      }
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    restaurant.businessHours = businessHours;
    await restaurant.save();

    return res.status(200).json({
      message: "Business hours updated successfully.",
      businessHours: restaurant.businessHours,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};



exports.updateOpeningHours = async (req, res) => {
  try {
    const {  restaurantId } = req.params;
    const { openingHours } = req.body;

    if (!Array.isArray(openingHours)) {
      return res.status(400).json({ message: "Opening hours must be an array." });
    }

    // Validate that each entry has the required fields
    for (const hour of openingHours) {
      if (!hour.day || !hour.openingTime || !hour.closingTime || typeof hour.isClosed !== 'boolean') {
        return res.status(400).json({ message: "Each opening hour entry must have day, openingTime, closingTime, and isClosed." });
      }
    }

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $set: { openingHours } },
      { new: true }
    );

    if (!updatedRestaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    res.status(200).json({
      message: "Opening hours updated successfully.",
      restaurant: updatedRestaurant,
    });
  } catch (error) {
    console.error("Error updating opening hours:", error);
    res.status(500).json({ message: "Server error", error });
  }
};



exports.updateRestaurantImages = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { remove } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    // Remove images if provided
    if (Array.isArray(remove) && remove.length) {
      restaurant.images = restaurant.images.filter((url) => !remove.includes(url));
    }

    // Upload new images from req.files.images
    if (req.files && req.files.images) {
      const uploadPromises = req.files.images.map(async (file) => {
        const uploadResult = await uploadOnCloudinary(file.path, 'orado_uploads');
        return uploadResult?.secure_url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      // Add uploaded URLs to images array
      restaurant.images.push(...uploadedUrls.filter(Boolean));
    }

    await restaurant.save();

    res.status(200).json({
      message: "Images updated successfully.",
      images: restaurant.images,
    });

  } catch (error) {
    console.error("Error updating images:", error);
    res.status(500).json({ message: "Server error" });
  }
};














exports.addKyc = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    let kycUrls = [];
    if (req.files && req.files.length > 0) {
      console.log("Uploading files to Cloudinary...");
      const uploads = await Promise.all(
        req.files.map((file) => uploadOnCloudinary(file.path))
      );
      console.log("Uploads result:", uploads);

      kycUrls = uploads
        .filter((result) => result && result.secure_url)
        .map((result) => result.secure_url);
    }

    restaurant.kycDocuments = [...restaurant.kycDocuments, ...kycUrls];

    restaurant.kycStatus = "pending";

    await restaurant.save();

    res.status(200).json({
      message: "KYC documents uploaded successfully.",
      restaurant,
    });
  } catch (error) {
    console.error("KYC upload error:", error);
    res.status(500).json({ message: "Server error while uploading KYC." });
  }
};

exports.getKyc = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    res.status(200).json({
      message: "KYC details fetched successfully.",
      kycDocuments: restaurant.kycDocuments || [],
      kycStatus: restaurant.kycStatus || "not-submitted",
    });
  } catch (error) {
    console.error("Error fetching KYC:", error);
    res.status(500).json({ message: "Server error while fetching KYC." });
  }
};


exports.addServiceArea = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { serviceAreas } = req.body;

    // Validate restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        message: "Invalid restaurant ID",
        messageType: "failure",
      });
    }

    // Validate serviceAreas array
    if (!Array.isArray(serviceAreas) || serviceAreas.length === 0) {
      return res.status(400).json({
        message: "serviceAreas must be a non-empty array",
        messageType: "failure",
      });
    }

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        message: "Restaurant not found",
        messageType: "failure",
      });
    }

    // Validate each service area based on type
    for (const sa of serviceAreas) {
      if (!sa.type || !["Polygon", "Circle"].includes(sa.type)) {
        return res.status(400).json({
          message: "Each serviceArea must have a valid type: 'Polygon' or 'Circle'",
          messageType: "failure",
        });
      }

      if (sa.type === "Polygon") {
        if (!sa.area || !Array.isArray(sa.area.coordinates) || sa.area.coordinates.length === 0) {
          return res.status(400).json({
            message: "Polygon type serviceArea must have valid 'area.coordinates'",
            messageType: "failure",
          });
        }
      } else if (sa.type === "Circle") {
        if (!sa.center || !Array.isArray(sa.center) || sa.center.length !== 2 || !sa.radius || sa.radius <= 0) {
          return res.status(400).json({
            message: "Circle type serviceArea must have valid 'center' [lng, lat] and 'radius' > 0",
            messageType: "failure",
          });
        }
      }
    }

    // Remove old service areas (replace mode)
    await ServiceArea.deleteMany({ restaurantId });

    // Insert new service areas
    const insertedAreas = await ServiceArea.insertMany(
      serviceAreas.map((sa) => ({
        restaurantId,
        ...sa
      }))
    );

    return res.status(200).json({
      message: "Service areas updated successfully",
      messageType: "success",
      data: insertedAreas,
    });

  } catch (error) {
    console.error("Error updating service areas:", error);
    return res.status(500).json({
      message: "Server error",
      messageType: "failure",
    });
  }
};


exports.getServiceAreas = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Validate restaurant ID
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        message: "Invalid restaurant ID",
        messageType: "failure",
      });
    }

    // Fetch service areas for the restaurant
    const serviceAreas = await ServiceArea.find({ restaurantId });

    return res.status(200).json({
      message: "Service areas fetched successfully",
      messageType: "success",
      data: serviceAreas,
    });
  } catch (error) {
    console.error("Error fetching service areas:", error);
    return res.status(500).json({
      message: "Server error",
      messageType: "failure",
    });
  }
};

exports.deleteServiceAreas = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        message: "Invalid restaurant ID",
        messageType: "failure",
      });
    }

    // Directly clear serviceAreas using $set
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $set: { serviceAreas: [] } },
      { new: true }
    );

    if (!updatedRestaurant) {
      return res.status(404).json({
        message: "Restaurant not found",
        messageType: "failure",
      });
    }

    return res.status(200).json({
      message: "Service areas deleted successfully",
      messageType: "success",
      data: updatedRestaurant.serviceAreas,
    });
  } catch (error) {
    console.error(`[ServiceArea::Delete] Error: ${error.message}`);
    return res.status(500).json({
      message: "Something went wrong while deleting service areas",
      messageType: "failure",
    });
  }
};

exports.deleteServiceAreas = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        message: "Invalid restaurant ID",
        messageType: "failure",
      });
    }

    // Delete all service areas for this restaurant
    const deleteResult = await ServiceArea.deleteMany({ restaurantId });

    return res.status(200).json({
      message: "Service areas deleted successfully",
      messageType: "success",
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error(`[ServiceArea::Delete] Error: ${error.message}`);
    return res.status(500).json({
      message: "Something went wrong while deleting service areas",
      messageType: "failure",
    });
  }
};




  

exports.getRestaurantMenu = async (req, res) => {
  const { restaurantId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        message: "Invalid restaurantId format",
        messageType: "failure",
        data: null,
      });
    }

    const categories = await Category.find({ restaurantId, active: true });

    if (!categories.length) {
      return res.status(404).json({
        message: "No categories found for this restaurant.",
        messageType: "failure",
        data: null,
      });
    }

    // Use a Moment object for current time
    const currentMoment = moment();

    const menu = await Promise.all(
      categories.map(async (category) => {
        let products = await Product.find({
          restaurantId,
          categoryId: category._id,
          active: true,
        }).select("-revenueShare -costPrice -profitMargin");

        products = products.map((p) => {
          let isAvailable = true;
          let reason = null;

          if (p.enableInventory && p.stock <= 0) {
            isAvailable = false;
            reason = "Out of stock";
          } else if (p.availability === "out-of-stock") {
            isAvailable = false;
            reason = "Temporarily unavailable";
          } else if (p.availability === "time-based") {
            if (!p.availableAfterTime) {
              isAvailable = false;
              reason = "Availability time not set";
            } else {
              const [hour, minute] = p.availableAfterTime.split(":").map(Number);
              const productAvailableMoment = moment()
                .hour(hour)
                .minute(minute)
                .second(0);

              if (currentMoment.isBefore(productAvailableMoment)) {
                isAvailable = false;
                reason = `Available after ${productAvailableMoment.format(
                  "hh:mm A"
                )}`;
              }
            }
          }

          return {
            ...p.toObject(),
            isAvailable,
            unavailableReason: reason,
          };
        });

        return {
          categoryId: category._id,
          categoryName: category.name,
          description: category.description,
          images: category.images,
          totalProducts: products.length,
          items: products,
        };
      })
    );

    res.status(200).json({
      message: "Menu fetched successfully",
      messageType: "success",
      data: menu,
    });
  } catch (error) {
    console.error("Error fetching menu:", error);
    res.status(500).json({
      message: "Failed to fetch restaurant menu",
      messageType: "failure",
      data: null,
    });
  }
};


// get all restauants

exports.getAllApprovedRestaurants = async (req, res) => {
  try {
    const approvedRestaurants = await Restaurant.find().select("-kycDocuments");
    res.status(200).json({
      message: "Approved restaurants fetched successfully.",
      count: approvedRestaurants.length,
      restaurants: approvedRestaurants,
    });
  } catch (error) {
    console.error("Error fetching approved restaurants:", error);
    res.status(500).json({
      message: "Failed to fetch approved restaurants.",
      error: error.message,
    });
  }
};

exports.updateRestaurantOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Update order status
    order.status = status;

    // If restaurant provides estimated prep time, update it

    await order.save();

    res.status(200).json({
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

exports.getRestaurantEarningSummary = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { timeFrame } = req.query; // 'day', 'week', 'month', 'year'

    // Validate restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant ID",
      });
    }

    // Create ObjectId instance
    const restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);

    // Base query
    const baseQuery = { restaurantId: restaurantObjectId };

    // Add time filtering based on the requested timeFrame
    let dateFilter = {};
    const now = new Date();

    if (timeFrame) {
      switch (timeFrame.toLowerCase()) {
        case "day":
          dateFilter = {
            createdAt: {
              $gte: new Date(now.setHours(0, 0, 0, 0)),
              $lt: new Date(now.setHours(23, 59, 59, 999)),
            },
          };
          break;
        case "week":
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);

          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          dateFilter = {
            createdAt: {
              $gte: startOfWeek,
              $lt: endOfWeek,
            },
          };
          break;
        case "month":
          dateFilter = {
            createdAt: {
              $gte: new Date(now.getFullYear(), now.getMonth(), 1),
              $lt: new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                0,
                23,
                59,
                59,
                999
              ),
            },
          };
          break;
        case "year":
          dateFilter = {
            createdAt: {
              $gte: new Date(now.getFullYear(), 0, 1),
              $lt: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
            },
          };
          break;
        default:
          // No time filter if invalid timeFrame provided
          break;
      }
    }

    // Get earnings with time filter
    const earnings = await RestaurantEarning.find({
      ...baseQuery,
      ...dateFilter,
    });

    if (earnings.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No earnings found for this restaurant${
          timeFrame ? ` in the current ${timeFrame}` : ""
        }`,
      });
    }

    // Calculate comprehensive summary
    const summary = earnings.reduce(
      (acc, curr) => {
        acc.totalOrders += 1;
        acc.totalAmount += curr.totalOrderAmount || 0;
        acc.totalCommission += curr.commissionAmount || 0;
        acc.totalNetEarnings += curr.restaurantNetEarning || 0;

        // Track payout status counts
        const status = curr.payoutStatus?.toLowerCase() || "pending";
        acc.payoutStatusCounts[status] =
          (acc.payoutStatusCounts[status] || 0) + 1;

        // Track commission types
        if (curr.commissionType === "percentage") {
          acc.percentageCommissionOrders += 1;
        } else {
          acc.fixedCommissionOrders += 1;
        }

        return acc;
      },
      {
        totalOrders: 0,
        totalAmount: 0,
        totalCommission: 0,
        totalNetEarnings: 0,
        payoutStatusCounts: {},
        percentageCommissionOrders: 0,
        fixedCommissionOrders: 0,
        averageCommissionRate: 0,
      }
    );

    // Calculate average commission rate
    summary.averageCommissionRate =
      earnings.length > 0 && summary.totalAmount > 0
        ? ((summary.totalCommission / summary.totalAmount) * 100).toFixed(2)
        : 0;

    // Get time-based breakdown
    const timeBreakdown = await getTimeBreakdown(restaurantObjectId, timeFrame);

    res.status(200).json({
      success: true,
      timeFrame: timeFrame || "all",
      summary: {
        ...summary,
        ...timeBreakdown,
      },
      currency: "INR",
    });
  } catch (error) {
    console.error("Error fetching earning summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch earning summary",
      error: error.message,
    });
  }
};

// Helper function to get time-based breakdown
async function getTimeBreakdown(restaurantId, timeFrame) {
  try {
    const breakdown = {};

    // For weekly/monthly/yearly breakdowns
    if (timeFrame === "year") {
      // Group by month
      const monthlyEarnings = await RestaurantEarning.aggregate([
        { $match: { restaurantId } },
        {
          $group: {
            _id: { $month: "$createdAt" },
            totalAmount: { $sum: "$totalOrderAmount" },
            totalNetEarnings: { $sum: "$restaurantNetEarning" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      breakdown.monthlyBreakdown = monthlyEarnings.map((month) => ({
        month: month._id,
        totalAmount: month.totalAmount,
        totalNetEarnings: month.totalNetEarnings,
        orderCount: month.count,
      }));
    } else if (timeFrame === "month") {
      // Group by day
      const dailyEarnings = await RestaurantEarning.aggregate([
        { $match: { restaurantId } },
        {
          $group: {
            _id: { $dayOfMonth: "$createdAt" },
            totalAmount: { $sum: "$totalOrderAmount" },
            totalNetEarnings: { $sum: "$restaurantNetEarning" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      breakdown.dailyBreakdown = dailyEarnings.map((day) => ({
        day: day._id,
        totalAmount: day.totalAmount,
        totalNetEarnings: day.totalNetEarnings,
        orderCount: day.count,
      }));
    } else if (timeFrame === "week") {
      // Group by day of week
      const weeklyEarnings = await RestaurantEarning.aggregate([
        { $match: { restaurantId } },
        {
          $group: {
            _id: { $dayOfWeek: "$createdAt" },
            totalAmount: { $sum: "$totalOrderAmount" },
            totalNetEarnings: { $sum: "$restaurantNetEarning" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      breakdown.weeklyBreakdown = weeklyEarnings.map((day) => ({
        dayOfWeek: day._id,
        totalAmount: day.totalAmount,
        totalNetEarnings: day.totalNetEarnings,
        orderCount: day.count,
      }));
    }

    return breakdown;
  } catch (error) {
    console.error("Error in getTimeBreakdown:", error);
    return {};
  }
}

// Get all orders for a specific restaurant (with pagination, filtering, and sorting)

exports.getRestaurantOrders = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      page = 1,
      limit = 10,
      status, // Optional status filter
    } = req.query;

    // Validate restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ error: "Invalid restaurant ID" });
    }

    // Build query filters
    const query = { restaurantId };
    if (status) query.status = status;

    // Execute query with pagination
    const orders = await Order.find(query)
      .populate("customerId", "name email phone")
      .populate("assignedAgent", "name email phone") // Added agent population
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const totalOrders = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNextPage: parseInt(page) * parseInt(limit) < totalOrders,
      },
    });
  } catch (error) {
    console.error("Order fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getRestaurantEarnings = async (req, res) => {
  try {
    const {
      restaurantId,
      period,
      fromDate,
      toDate,
      page = 1,
      limit = 50,
    } = req.query;
    console.log("Query:", req.query);
    const query = {};
    if (restaurantId) {
      if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res
          .status(400)
          .json({ message: "Invalid restaurantId format." });
      }
      query.restaurantId = restaurantId;
    }

    if (period) {
      let start, end;
      switch (period) {
        case "today":
          start = moment().startOf("day").toDate();
          end = moment().endOf("day").toDate();
          break;
        case "week":
          start = moment().startOf("week").toDate();
          end = moment().endOf("week").toDate();
          break;
        case "month":
          start = moment().startOf("month").toDate();
          end = moment().endOf("month").toDate();
          break;
        default:
          return res.status(400).json({ message: "Invalid period value" });
      }
      query.createdAt = { $gte: start, $lte: end };
    }

    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return res
          .status(400)
          .json({ message: "Invalid fromDate or toDate format" });
      }
      query.createdAt = { $gte: from, $lte: to };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const earnings = await RestaurantEarning.find(query)
      .populate({
        path: "restaurantId",
        select: "name location phoneNumber",
      })
      .populate({
        path: "orderId",
        select: "orderItems totalAmount paymentMethod paymentStatus createdAt",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // 📦 Map formatted earnings and compute totals
    let totalOrderAmount = 0;
    let totalCommission = 0;
    let totalNetRevenue = 0;

    const formattedEarnings = earnings.map((item) => {
      totalOrderAmount += item.totalOrderAmount;
      totalCommission += item.commissionAmount;
      totalNetRevenue += item.restaurantNetEarning;

      return {
        id: item._id,
        restaurantName: item.restaurantId?.name,
        restaurantId: item.restaurantId?._id,
        restaurantLocation: item.restaurantId?.location,
        orderAmount: item.totalOrderAmount,
        commissionType: item.commissionType,
        commissionValue: item.commissionValue,
        commissionAmount: item.commissionAmount,
        netRevenue: item.restaurantNetEarning,
        payoutStatus: item.payoutStatus,
        paymentMethod: item.orderId?.paymentMethod,
        paymentStatus: item.orderId?.paymentStatus,
        orderItems: item.orderId?.orderItems,
        orderDate: item.orderId?.createdAt,
        earningCreatedAt: item.createdAt,
      };
    });

    res.status(200).json({
      message: "Restaurant earnings report fetched successfully",
      count: formattedEarnings.length,
      summary: {
        totalOrderAmount,
        totalCommission,
        totalNetRevenue,
      },
      page: parseInt(page),
      limit: parseInt(limit),
      data: formattedEarnings,
    });
  } catch (err) {
    console.error("Error fetching restaurant earnings report:", err);
    res.status(500).json({
      message: "Failed to fetch restaurant earnings report",
      error: err.message,
    });
  }
};

exports.getRestaurantEarningsList = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate && endDate) {
      matchStage.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const result = await RestaurantEarning.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$restaurantId", // This is restaurantId
          totalOrderAmount: { $sum: "$totalOrderAmount" },
          totalCommission: { $sum: "$commissionAmount" },
          totalNetRevenue: { $sum: "$restaurantNetEarning" },
          orderCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "restaurants",
          localField: "_id",
          foreignField: "_id",
          as: "restaurant",
        },
      },
      { $unwind: "$restaurant" },
      {
        $project: {
          restaurantId: "$_id", // 👈 Add this line
          restaurantName: "$restaurant.name",
          totalOrderAmount: 1,
          totalCommission: 1,
          totalNetRevenue: 1,
          orderCount: 1,
        },
      },
      { $sort: { totalOrderAmount: -1 } },
    ]);

    res.json({
      totalRestaurants: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Error generating earnings summary", error);
    res.status(500).json({ error: "Server error" });
  }
};
exports.getRestaurantEarningv2 = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (
      !restaurantId ||
      restaurantId === "undefined" ||
      !mongoose.Types.ObjectId.isValid(restaurantId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant ID",
      });
    }

    const { startDate, endDate, page = 1, limit = 10 } = req.query;
    const restaurantObjectId = new Types.ObjectId(restaurantId);

    // Date filter for earnings & orders
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // 1️⃣ Summary Aggregation
    const summary = await RestaurantEarning.aggregate([
      {
        $match: {
          restaurantId: restaurantObjectId,
          ...(startDate && endDate ? dateFilter : {}),
        },
      },
      {
        $group: {
          _id: null,
          totalCartTotal: { $sum: "$cartTotal" },
          totalOrderAmount: { $sum: "$totalOrderAmount" },
          totalCommission: { $sum: "$commissionAmount" },
          totalNetRevenue: { $sum: "$restaurantNetEarning" },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    // 2️⃣ Orders Data with Earnings, Customer, Agent, Products
    const ordersData = await Order.aggregate([
      {
        $match: {
          restaurantId: restaurantObjectId,
          orderStatus: "delivered",
          ...(startDate && endDate ? { orderTime: dateFilter.createdAt } : {}),
        },
      },
      {
        $lookup: {
          from: "restaurantearnings",
          localField: "_id",
          foreignField: "orderId",
          as: "earnings",
        },
      },
      { $unwind: { path: "$earnings", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "assignedAgent",
          foreignField: "_id",
          as: "agent",
        },
      },
      { $unwind: { path: "$agent", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.productId",
          foreignField: "_id",
          as: "products",
        },
      },
      {
        $project: {
          orderItems: 1,
          orderTime: 1,
          deliveryTime: 1,
          paymentMethod: 1,
          walletUsed: 1,
          totalAmount: 1,
          deliveryAddress: 1,
          orderStatus: 1,
          assignedAgent: "$agent",
          customerId: "$customer",
          cartTotal: "$subtotal",
          offerDiscount: 1,
          discountAmount: 1,
          commissionAmount: { $ifNull: ["$earnings.commissionAmount", 0] },
          restaurantNetEarning: {
            $ifNull: ["$earnings.restaurantNetEarning", 0],
          },
          products: 1,
        },
      },
      {
        $facet: {
          metadata: [
            { $count: "total" },
            {
              $addFields: {
                page: parseInt(page),
                limit: parseInt(limit),
              },
            },
          ],
          data: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
          ],
        },
      },
    ]);

    // 3️⃣ Payment Method Counts
    const paymentStats = await Order.aggregate([
      {
        $match: {
          restaurantId: restaurantObjectId,
          orderStatus: "delivered",
          ...(startDate && endDate ? { orderTime: dateFilter.createdAt } : {}),
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
        },
      },
    ]);

    // 4️⃣ Final Response Structuring
    const result = {
      docs: ordersData[0].data,
      total: ordersData[0].metadata[0]?.total || 0,
      limit: parseInt(limit),
      page: parseInt(page),
      pages: Math.ceil(
        (ordersData[0].metadata[0]?.total || 0) / parseInt(limit)
      ),
    };

    res.json({
      success: true,
      summary: summary[0] || {
        totalCartTotal: 0,
        totalOrderAmount: 0,
        totalCommission: 0,
        totalNetRevenue: 0,
        orderCount: 0,
      },
      paymentSummary: paymentStats,
      orders: result,
    });
  } catch (error) {
    console.error("❌ Payout report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch restaurant earnings",
      error: error.message,
    });
  }
};

exports.toggleRestaurantActiveStatus = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Atomic toggle using findByIdAndUpdate
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $set: { active: !restaurant.active } },
      { new: true }
    );

    return res.status(200).json({
      message: `Restaurant is now ${
        updatedRestaurant.active ? "Active" : "Inactive"
      }`,
      activeStatus: updatedRestaurant.active,
    });
  } catch (error) {
    console.error("Error toggling restaurant active status:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};