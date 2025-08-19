const jwt = require("jsonwebtoken");
const User = require("../models/userModel"); 
const Restaurant = require("../models/restaurantModel");
const Permission = require("../models/restaurantPermissionModel");
const Session = require("../models/session");
const ChangeRequest = require("../models/changeRequest");
const Product = require("../models/productModel")
const Agent = require("../models/agentModel");
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Validate session token exists in DB
      const session = await Session.findOne({ token, userId: decoded.userId });
      if (!session) {
        return res.status(401).json({ message: "Session expired or invalid" });
      }

      // Optional: Check if session is expired manually (for extra control)
      if (session.expiresAt && new Date() > session.expiresAt) {
        await session.deleteOne(); // clean it up
        return res.status(401).json({ message: "Session expired" });
      }

      const user = await User.findById(decoded.userId).select("-password");
      if (!user) return res.status(401).json({ message: "User not found" });

      req.user = user;
      req.session = session;
      next();

    } catch (err) {
      console.error("Auth Error:", err);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  } else {
    return res.status(401).json({ message: "No token provided" });
  }
};

exports.protectAgent = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // This will throw if token is expired or invalid
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get agent data
      const agent = await Agent.findById(decoded.agentId).select("-password");
      if (!agent) {
        return res.status(401).json({ message: "Agent not found" });
      }

      req.user = agent;
      next();
    } catch (err) {
      console.error("Agent Auth Error:", err);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  } else {
    return res.status(401).json({ message: "No token provided" });
  }
};

exports.checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.user; // assuming you've added user from JWT middleware

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Bypass role check if user is superAdmin
    if (user.isSuperAdmin) {
      return next();
    }

    if (!allowedRoles.includes(user.userType)) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    next(); // Allowed, carry on
  };
};


exports.checkPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.isSuperAdmin) return next();

    if (
      user.userType === "admin" &&
      Array.isArray(user.adminPermissions) &&
      requiredPermissions.every(p => user.adminPermissions.includes(p))
    ) {
      return next();
    }

    return res.status(403).json({
      message: `Forbidden: Missing required permissions.`,
      required: requiredPermissions,
      current: user.adminPermissions,
    });
  };
};


// for restaurant permissions
exports.checkRestaurantPermission = (permissionKey, allowRequest = false, customMessage = null) => {
  return async (req, res, next) => {
    try {
      // FIRST check req.restaurantId (set by attachRestaurantFromProduct)
      // THEN fall back to other locations
      console.log(req.params.restaurantId)
      const restaurantId = req.restaurantId || req.body.restaurantId || req.params.restaurantId || req.query.restaurantId;
      
      if (!restaurantId) {
        return res.status(400).json({ message: "restaurantId is required" });
      }

      const restaurant = await Restaurant.findOne({ 
        _id: restaurantId, 
        ownerId: req.user._id 
      });
      console.log(restaurant)
      if (!restaurant) {
        return res.status(404).json({ 
          message: "Restaurant not found or you don't have access" 
        });
      }
      
      // Rest of your permission checking logic...
      const permissionDoc = await Permission.findOne({ restaurantId: restaurant._id });
   
      if (permissionDoc?.permissions?.[permissionKey]) {
        req.restaurant = restaurant;
        return next();
      }

      if (!allowRequest) {
        return res.status(403).json({
          message: customMessage || "Permission denied."
        });
      }

      await ChangeRequest.create({
        restaurantId: restaurant._id,
        requestedBy: req.user._id,
        type: "PERMISSION_UPDATE",
        data: { permissionKey },
        note: `Permission requested for ${permissionKey}`
      });

      return res.status(403).json({
        message: customMessage || `Permission request for "${permissionKey}" sent to admin`
      });

    } catch (err) {
      console.error('Permission check error:', err);
      return res.status(500).json({ 
        message: "Internal server error during permission check",
        error: err.message 
      });
    }
  };
};



exports.attachRestaurantFromProduct = async (req, res, next) => {
  try {
    if (!req.params.productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const product = await Product.findById(req.params.productId)
      .select('restaurantId')
      .lean(); // Convert to plain JavaScript object

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (!product.restaurantId) {
      return res.status(400).json({ 
        message: "Product is not associated with any restaurant" 
      });
    }

    // Ensure restaurantId is properly converted to string if needed
    req.restaurantId = product.restaurantId.toString();
    next();
  } catch (err) {
    console.error('Error in attachRestaurantFromProduct:', err);
    res.status(500).json({ 
      message: "Internal server error while processing product",
      error: err.message 
    });
  }
};
