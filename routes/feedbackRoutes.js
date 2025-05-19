const express = require('express');
const router = express.Router();
// const { protect } = require('../middleware/authMiddleware');
const { getAverageRating, getFeedbacks, deleteFeedback, updateFeedback, createFeedback } = require('../controllers/feedbackController');

// Protected routes (requires login)
//needed protected currentlyusing for test
router.post('/',createFeedback);
router.put('/:id',updateFeedback);
router.delete('/:id',deleteFeedback);

// Public route for viewing feedbacks and ratings
router.get('/:type/:id',getFeedbacks); // /restaurant/:id
router.get('/rating/:type/:id', getAverageRating); // /rating/restaurant/:id

module.exports = router;
