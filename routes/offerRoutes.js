const express = require('express');
const router = express.Router();

const { protect, checkRole, checkRestaurantPermission } = require('../middlewares/authMiddleware');
const { upload } = require('../middlewares/multer');

// Admin Offer CRUD




module.exports = router;
