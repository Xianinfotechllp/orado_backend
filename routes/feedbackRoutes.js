const express = require('express');
const router = express.Router();
// const { protect } = require('../middleware/authMiddleware');
const { getAverageRating, getFeedbacks, deleteFeedback, updateFeedback, createFeedback, createRestaurantFeedback, getRestaurantReviews ,replyToFeedbackByRestaurant ,getRestaurantProductReviews, addProductReview ,replyToProductReview } = require('../controllers/feedbackController');
const {protect, checkRole} = require('../middlewares/authMiddleware')
const { upload } = require('../middlewares/multer');

// Protected routes (requires login)
// //needed protected currentlyusing for test
router.post(
  '/',
  protect,
  upload.any(), 
  createFeedback
);

router.post(
  '/restaurant',
  upload.any(),
  protect, 
  createRestaurantFeedback
);
// router.put('/:id', protect, checkRole('customer'), updateFeedback);
// router.delete('/:id', protect, checkRole('customer'), deleteFeedback);

// // Public route for viewing feedbacks and ratings
// router.get('/:type/:id',getFeedbacks); // /restaurant/:id
// router.get('/rating/:type/:id', getAverageRating); // /rating/restaurant/:id


router.get("/restaurants/:restaurantId",getRestaurantReviews)
router.post("/restaurants/:restaurantId/feedback/:feedbackId/replay",replyToFeedbackByRestaurant)
router.get("/product/restaurants/:restaurantId/",getRestaurantProductReviews )

router.post('/product-feedback/:feedbackId/reply',replyToProductReview);

//crete product feedback by user 
router.post("/product/:productId",protect,  upload.array('images', 5),addProductReview)





module.exports = router;
