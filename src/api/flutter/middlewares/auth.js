const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authorization token missing.",
      messageType: "failure",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // you can access req.user in your routes now
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return res.status(401).json({
      message: "Invalid or expired token.",
      messageType: "failure",
    });
  }
};
