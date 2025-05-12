const rateLimtit = require('express-rate-limit');
const bruteForcePrevent = rateLimtit({

    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit to 5 requests per IP within 15 min
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      return res.status(429).json({
        message: "Too many login attempts from this IP, please try again after 15 minutes",
      });
    },

}) 

 module.exports = bruteForcePrevent;