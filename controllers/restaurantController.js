const Restaurant = require("../models/restaurantModel")
const mongoose = require("mongoose");
exports.createRestaurant = async (req, res) => {
  try {
    const {
      name,
      ownerId,
      address,
      phone,
      email,
      openingHours,
      foodType,
      merchantSearchName,
      minOrderAmount,
      paymentMethods, // optional if you want to send this too
    } = req.body;

    if (
      !name ||
      !ownerId ||
      !address ||
      !phone ||
      !email ||
      !openingHours ||
      !foodType ||
      !merchantSearchName ||
      !minOrderAmount ||
      !address.coordinates
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Phone validation
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number." });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email address." });
    }

    // Address validation
    const { street, city, state, pincode, coordinates } = address;
    if (!street || !city || !state || !pincode) {
      return res.status(400).json({
        message:
          "Complete address is required: street, city, state, pincode.",
      });
    }

    if (
      typeof street !== "string" ||
      street.trim() === "" ||
      typeof city !== "string" ||
      city.trim() === "" ||
      typeof state !== "string" ||
      state.trim() === ""
    ) {
      return res.status(400).json({
        message:
          "Address fields street, city, and state must be non-empty strings.",
      });
    }

    const pincodeRegex = /^[1-9][0-9]{5}$/;
    if (!pincodeRegex.test(pincode)) {
      return res
        .status(400)
        .json({
          message:
            "Invalid pincode. It must be a 6-digit number starting with 1-9.",
        });
    }

    // Opening hours validation
    const { startTime, endTime } = openingHours;
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        message: "Invalid time format. Please use HH:mm.",
      });
    }

    // Food type validation
    const validFoodTypes = ["veg", "non-veg", "both"];
    if (!validFoodTypes.includes(foodType)) {
      return res.status(400).json({
        message: "Invalid foodType. Valid values are: veg, non-veg, both.",
      });
    }

    // Min order amount validation
    if (typeof minOrderAmount !== "number" || minOrderAmount <= 0) {
      return res.status(400).json({
        message: "Minimum order amount must be a positive number.",
      });
    }

   // Coordinates validation
if (
  !Array.isArray(coordinates) ||
  coordinates.length !== 2 ||
  typeof coordinates[0] !== "number" ||
  typeof coordinates[1] !== "number"
) {
  return res.status(400).json({
    message: "Invalid coordinates. Must be an array: [latitude, longitude] as numbers.",
  });
}

const [latitude, longitude] = coordinates;

if (latitude < -90 || latitude > 90) {
  return res.status(400).json({
    message: "Invalid latitude. Must be between -90 and 90.",
  });
}

if (longitude < -180 || longitude > 180) {
  return res.status(400).json({
    message: "Invalid longitude. Must be between -180 and 180.",
  });
}
    // Build GeoJSON Point
    const location = {
      type: "Point",
      coordinates: [coordinates[1], coordinates[0]], // GeoJSON expects [lng, lat]
    };

    // Create new restaurant
    const newRestaurant = new Restaurant({
      name,
      ownerId,
      address: {
        street,
        city,
        state,
        zip: pincode,
      },
      phone,
      email,
      openingHours,
      foodType,
      merchantSearchName,
      minOrderAmount,
      location,
      paymentMethods,
    });

    await newRestaurant.save();
    res.status(201).json({
      message: "Restaurant created successfully.",
      restaurant: newRestaurant,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: 'Request body is missing.' });
    }

    const { restaurantId } = req.params;
    const {
      name,
      ownerId,
      address,
      phone,
      email,
      openingHours,
      foodType,
      merchantSearchName,
      minOrderAmount,
      images // ✅ new field
    } = req.body;

    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid restaurantId.' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' });
    }

    if (name) restaurant.name = name;
    if (ownerId) restaurant.ownerId = ownerId;
    if (merchantSearchName) restaurant.merchantSearchName = merchantSearchName;

    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Invalid phone number.' });
      }
      restaurant.phone = phone;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email address.' });
      }
      restaurant.email = email;
    }

    if (openingHours) {
      const { startTime, endTime } = openingHours;
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!startTime || !endTime || !timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({ message: 'Invalid time format. Use HH:mm.' });
      }
      restaurant.openingHours = openingHours;
    }

    if (foodType) {
      const validFoodTypes = ['veg', 'non-veg', 'both'];
      if (!validFoodTypes.includes(foodType)) {
        return res.status(400).json({ message: 'Invalid foodType.' });
      }
      restaurant.foodType = foodType;
    }

    if (minOrderAmount !== undefined) {
      if (typeof minOrderAmount !== 'number' || minOrderAmount <= 0) {
        return res.status(400).json({ message: 'Minimum order must be a positive number.' });
      }
      restaurant.minOrderAmount = minOrderAmount;
    }

    if (address) {
      const { street, city, state, pincode } = address;
      const pincodeRegex = /^[1-9][0-9]{5}$/;
      if (!street || !city || !state || !pincode || !pincodeRegex.test(pincode)) {
        return res.status(400).json({ message: 'Invalid or incomplete address.' });
      }
      restaurant.address = address;
    }

    // ✅ Image handling
    if (Array.isArray(images)) {
      restaurant.images = images;
    }

    await restaurant.save();
    res.status(200).json({ message: 'Restaurant updated successfully.', restaurant });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.deleteRestaurant = async (req, res) => {

  try {
     const { restaurantId } = req.params;
      if (!restaurantId) {
      return res.status(400).json({ message: 'restaurantId is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid restaurantId format.' });
    }
        const restaurant = await Restaurant.findOne({ _id: restaurantId });
           if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' });
    }

    await restaurant.deleteOne();
    res.status(200).json({ message: 'Restaurant deleted successfully.' });

    
  } catch (error) {

       console.error(error);
    res.status(500).json({ message: 'Server error.' });
    
  }
}

exports.getRestaurantById = async (req, res) => {
 
  try {
    const { restaurantId } = req.params;
  
    if (!restaurantId) {
      return res.status(400).json({ message: 'restaurantId is required.' });
    }
      if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid restaurantId format.' });
    }
       const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' });
    }

       res.status(200).json({ message: 'Restaurant fetched successfully.', restaurant });
  
  } catch (error) {
     console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }

}

// Enable merchants to set and update their daily and weekly business hours.
exports.updateBusinessHours = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { businessHours } = req.body;

    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid or missing restaurantId.' });
    }

    if (!businessHours || typeof businessHours !== 'object') {
      return res.status(400).json({ message: 'businessHours must be a valid object.' });
    }

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    for (const [day, times] of Object.entries(businessHours)) {
      if (!validDays.includes(day)) {
        return res.status(400).json({ message: `Invalid day: ${day}` });
      }

      const { startTime, endTime, closed } = times;

      if (closed === true) continue;

      if (!startTime || !endTime) {
        return res.status(400).json({ message: `Missing startTime or endTime for ${day}.` });
      }

      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({ message: `Invalid time format for ${day}. Use HH:mm.` });
      }
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' });
    }

    restaurant.businessHours = businessHours;
    await restaurant.save();

    return res.status(200).json({
      message: 'Business hours updated successfully.',
      businessHours: restaurant.businessHours
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
};




exports.addKyc = async (req, res) => {
  try {
    
  } catch (error) {
    
  }
}



exports.addServiceArea = async (req, res) => {
 
};