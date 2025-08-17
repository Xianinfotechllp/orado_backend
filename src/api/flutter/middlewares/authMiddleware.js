const jwt = require("jsonwebtoken");
const User = require("../../../../models/userModel"); 
const Restaurant = require("../../../../models/restaurantModel");
const Permission = require("../../../../models/restaurantPermissionModel");
const Session = require("../../../../models/session");
const ChangeRequest = require("../../../../models/changeRequest");

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // 👇 This ignores the exp claim
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        ignoreExpiration: true,
      });

      const user = await User.findById(decoded.userId).select("-password");
      if (!user) return res.status(401).json({ message: "User not found" });

      req.user = user;
      next();
    } catch (err) {
      console.error("Auth Error:", err);
      return res.status(401).json({ message: "Invalid token" });
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