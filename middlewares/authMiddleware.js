const jwt = require("jsonwebtoken");
const User = require("../models/userModel"); 
const Restaurant = require("../models/restaurantModel");
const Permission = require("../models/restaurantPermissionModel");
const Session = require("../models/session");
const ChangeRequest = require("../models/changeRequest");

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


exports.checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // SuperAdmins get everything by default
    if (user.isSuperAdmin) {
      return next();
    }

    // “admin” must have the permission in their adminPermissions array
    if (
      user.userType === "admin" &&
      Array.isArray(user.adminPermissions) &&
      user.adminPermissions.includes(requiredPermission)
    ) {
      return next();
    }

    // Otherwise, forbidden
    return res.status(403).json({ message: "Forbidden: insufficient permissions" });
  };
};

// for restaurant permissions

exports.checkRestaurantPermission = (permissionKey, allowRequest = false) => {
  return async (req, res, next) => {
    try {
      const restaurant = await Restaurant.findOne({ ownerId: req.user._id });
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const permissionDoc = await Permission.findOne({ restaurantId: restaurant._id });

      if (permissionDoc && permissionDoc.permissions?.[permissionKey]) {
        req.restaurant = restaurant;
        return next();
      }

      if (!allowRequest) {
        return res.status(403).json({ message: "Permission denied." });
      }

      // Automatically create a permission change request
      await ChangeRequest.create({
        restaurantId: restaurant._id,
        requestedBy: req.user._id,
        type: "PERMISSION_UPDATE",
        data: { permissionKey },
        note: `User requested permission for ${permissionKey}`
      });

      return res.status(403).json({
        message: `You don't have permission for "${permissionKey}". We've notified the admin.`
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  };
};