const Restaurant = require("../models/restaurantModel")
const mongoose = require("mongoose");
const { uploadOnCloudinary } = require('../utils/cloudinary'); 

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
      paymentMethods
    } = req.body;


    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploads = await Promise.all(
        req.files.map(file => uploadOnCloudinary(file.path))
      );
      imageUrls = uploads
        .filter(result => result && result.secure_url)
        .map(result => result.secure_url);
    }

    const location = {
      type: "Point",
      coordinates: [address?.coordinates?.[1], address?.coordinates?.[0]] // [lng, lat]
    };

    const newRestaurant = new Restaurant({
      name,
      ownerId,
      address: {
        street: address?.street,
        city: address?.city,
        state: address?.state,
        zip: address?.pincode,
      },
      phone,
      email,
      openingHours,
      foodType,
      merchantSearchName,
      minOrderAmount,
      paymentMethods,
      location,
      images: imageUrls,
    });

    await newRestaurant.save();
    res.status(201).json({
      message: "Restaurant created successfully.",
      restaurant: newRestaurant,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error.", error });
  }
};



exports.updateRestaurant = async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ message: 'Request body is missing.' });

    const { restaurantId } = req.params;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found.' });

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
      status
    } = req.body;

    // 🛠 Update basic fields if they exist
    if (name) restaurant.name = name;
    if (phone) restaurant.phone = phone;
    if (email) restaurant.email = email;
    if (foodType) restaurant.foodType = foodType;
    if (merchantSearchName) restaurant.merchantSearchName = merchantSearchName;
    if (minOrderAmount) restaurant.minOrderAmount = minOrderAmount;
    if (paymentMethods) restaurant.paymentMethods = paymentMethods;
    if (openingHours) restaurant.openingHours = openingHours;
    if (isActive !== undefined) restaurant.isActive = isActive;
    if (status) restaurant.status = status;

    // 🧭 Address and Location
    if (address) {
      restaurant.address.street = address?.street || restaurant.address.street;
      restaurant.address.city = address?.city || restaurant.address.city;
      restaurant.address.state = address?.state || restaurant.address.state;
      restaurant.address.zip = address?.pincode || restaurant.address.zip;

      if (address.coordinates && address.coordinates.length === 2) {
        restaurant.location = {
          type: "Point",
          coordinates: [address.coordinates[1], address.coordinates[0]],
        };
      }
    }

    // 🖼️ Image replacement (optional: delete old ones)
    if (req.files && req.files.length > 0) {
      const uploads = await Promise.all(
        req.files.map(file => uploadOnCloudinary(file.path))
      );
      const newImageUrls = uploads
        .filter(result => result && result.secure_url)
        .map(result => result.secure_url);

      // Replace images
      restaurant.images = newImageUrls;
    }

    await restaurant.save();
    res.status(200).json({
      message: 'Restaurant updated successfully.',
      restaurant
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.', error });
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
       const restaurant = await Restaurant.findOne({_id: restaurantId });
        if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' });
    }

       res.status(200).json({ message: 'Restaurant fetched successfully.', restaurant });
  
  } catch (error) {
     console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }

}

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
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    let kycUrls = [];
    if (req.files && req.files.length > 0) {
      console.log("Uploading files to Cloudinary...");
      const uploads = await Promise.all(
        req.files.map(file => uploadOnCloudinary(file.path))
      );
      console.log("Uploads result:", uploads);

      kycUrls = uploads
        .filter(result => result && result.secure_url)
        .map(result => result.secure_url);
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

}



exports.addServiceArea = async (req, res) => {
 
};

