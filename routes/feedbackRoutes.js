const express = require('express');
const router = express.Router();
// const { protect } = require('../middleware/authMiddleware');
const { getAverageRating, getFeedbacks, deleteFeedback, updateFeedback, createFeedback } = require('../controllers/feedbackController');
const {protect, checkRole} = require('../middlewares/authMiddleware')

// Protected routes (requires login)
//needed protected currentlyusing for test
router.post('/', protect, checkRole('customer'), createFeedback);
router.put('/:id', protect, checkRole('customer'), updateFeedback);
router.delete('/:id', protect, checkRole('customer'), deleteFeedback);

// Public route for viewing feedbacks and ratings
router.get('/:type/:id',getFeedbacks); // /restaurant/:id
router.get('/rating/:type/:id', getAverageRating); // /rating/restaurant/:id

module.exports = router;
